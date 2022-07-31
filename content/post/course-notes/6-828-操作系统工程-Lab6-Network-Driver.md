---
title: 6-828-操作系统工程-Lab6-Network Driver(Final)
categories:
  - sys
date: 2018-05-28 09:26:33
tags:
  - OS
---

这章节是完成一个网络驱动程序，现在系统中已经存在了文件系统里，所以可以添加一个网络栈，是基于`82540EM`芯片(E1000)。这章节内容比我想象中难，虽然之前概览了一下，但是实际做起来的时候涉及到的概念和知识超出我现在所掌握的。

# 准备

`git`

``` bash
    $ git add .
    $ git commit -am "lab 5 done"
    $ make handin
    $ git pull
    $ git checkout -b  lab6 origin/lab6
    $ git merge lab5
        Auto-merging lib/fd.c
        Auto-merging kern/trap.c
        Auto-merging kern/syscall.c
        Auto-merging kern/init.c
        Auto-merging inc/lib.h
        Auto-merging fs/serv.c
        Merge made by the 'recursive' strategy.
         boot/main.c       |     1 -
         fs/bc.c           |    22 +-
         fs/fs.c           |    73 +-
         ....
         user/faultio.c    |     2 +-
         user/forktree.c   |     1 +
         user/sh.c         |     9 +-
         user/testfile.c   |     5 +
         33 files changed, 14503 insertions(+), 111 deletions(-)
```

除了完成网卡驱动，还需要
1.创建一个系统调用接口来访问驱动。
2.实现服务器和驱动网络栈传输数据包的代码。
3.完成一个web服务器

数据包调试

tcpdump -XXnr qemu.pcap 或者使用wireshark也行。


# 网络服务
从零开始实现一个网络栈([协议栈](https://en.wikipedia.org/wiki/Protocol_stack))是一件非常困难的事情。所以会用到一个轻量级的开源的TCP/IP协议簇[LwIP](https://blog.csdn.net/yangzhao0001/article/details/48625927)(lightweight IP)来实现接下来的工作。在这里需要把LwIP看成一个黑箱，它是实现了BSD的套接字接口到了输出端口和输入端口。\

![overviews.png]( /images/operating-system/6.828/lab6/overviews.png)

所以网络服务实际上就是4个环境(进程)的结合：
1. 核心网络服务器环境(套接字分发和LwIP)
套接字调用调度工作方式很像文件服务，用户环境使用存根stubs(lib/nsipc.c)发送IPC信息到核心网络环境。`i386_init`创建一个NS_TYPE_NS类型的NS环境，然后扫描envs这个全局变量可以找到特殊的环境。对于任何一个用户环境，网络服务中的调度器调用合适的由LwIP提供的BSD套接字接口函数。
普通的用户环境使用`lib/sockets`中的函数发送sokets，这是基于文件描述符的套接字API。就像之前使用磁盘中的文件一样，用户环境使用套接字也是通过文件描述符。像`connect`，`accept`操作指定接收类型为套接字，而`read`，`write`等操作是通过接收普通的文件描述符，所以可通过LwIP为开启的套接字生成的独一无二的ID映射到对应的文件描述符上。
文件服务和网络服务中的IPC分发工作即使相同，但有一点关键不同的在于BSD套接字调用`accept`和`recv`能够无尽的阻塞。如果分发器让LwIP执行一个阻塞操作，这整个系统都会被阻塞，所以网络服务使用用户级别的线程去避免阻塞整个服务。对于到来的IPC消息，分发器创建一个线程并且处理这个请求。如果线程阻塞了，那么只有该线程被置为睡眠状态而其他线程仍在运行。

2. 输出环境
当用户环境的套接字服务函数被调用，IwIP将会生成一个被网卡传输的数据包。核心网络环境将通过IPC信息并把要发送的包作为共享页给输出环境，那么接下来输出环境将会接收这些信息并且将这些包通过网卡驱动发送出去。

3. 输入环境
网卡收到包之后需要注入到LwIP中去，对于每一个通过设备驱动接收到的包，输入环境将会把这些包调出内核空间并且用IPC将包发送到核心服务环境中去。

4. 计时器环境
计时器环境周期性的发送`NSREQ_TIMER`到核心网络服务提醒计时器已经过期了，这个环境被用作多种网络的超时报告。

# 初始化并且发送包
现在内核还没有时间的概念，现在需要加上这个，时钟中断是每10ms发送一次，所以当时钟中断发生的时候，自增一个变量让时间前进。


# 练习 1
当时钟中断发生的时候，调用time_tick来自增时间
实现`sys_time_msec`使得用户环境能获取当前时间

`trap.c`
``` C
# trap_dispatch()
    if (tf->tf_trapno == IRQ_OFFSET + 0) {
        time_tick();
        lapic_eoi();
        //cprintf("clock interrput: ");
        sched_yield();
    }
```

`sys_time_msec`
``` C
static int
sys_time_msec(void)
{
    // LAB 6: Your code here.
    //panic("sys_time_msec not implemented");
    return time_msec();
}
```


# 网卡接口
接下来就是准备写网卡驱动，但是需要知道硬件和接口怎么在软件中表示。

# 练习 2
练习2的任务阅读Intel手册关于E1000的部分，章节2概览，章节3和14细节。
E1000是一种非常复杂的设备并且拥有很多优越的特性，只需要利用很少的一部分E1000的特性和接口就能完成工作。
这里不得不重新审视下驱动，驱动程序是计算机操作和控制特殊类型的被附加到计算机的设备，为硬件提供软件的接口，使得操作系统或者其他程序能访问硬件功能(hardware function)但是不需要直到使用硬件的细节。绝大多数驱动都是运行在内核态，操作硬件资源，访问底层资源。

第二章节我关注了几个点
1. DMA Engine and Data FIFO
2. DMA 寻址
网络数据都是字节流，所以确认处理器处理的方式和网卡控制器需要以相同的方式处理字节流，PCI是使用的little-endian，低位字节排放在内存的低地址端。

![bytesordering.png]( /images/operating-system/6.828/lab6/bytesordering.png)

以太网控制器中有几个存放以太网物理地址的寄存器，两个32位的寄存器组成地址，RAH(Receive Address High)和RAL(Receive Address Low)。
// todo： 为什么mac地址是6个字节？并不方便两个寄存器处理。

![stream.png]( /images/operating-system/6.828/lab6/stream.png)

以太网帧从外部发来后，字节流从左往右对应，处理数据。比如地址`00_AA_00_11_22_33h`，除去帧的其他部分，首先出现在总线上的是最低有效位的0bit位。这里涉及到了一个组播比特位，详情可看[这里](https://networklessons.com/multicast/multicast-ip-address-to-mac-address-mapping/)，组播的话该最先出现的位会被置为1。最后处理完后在缓冲区的情况如下:

![table.png]( /images/operating-system/6.828/lab6/table.png)
![array.png]( /images/operating-system/6.828/lab6/array.png)

顺便复习下mac帧的结构和作用

![struct.png]( /images/operating-system/6.828/lab6/struct.png)
![frame.png]( /images/operating-system/6.828/lab6/frame.png)

3.  中断
也就是外部中断发送到I/O APIC，接收到外部中断后，cpu开始执行相应的外部中断处理程序，在这，就是处理网络包。
4.  卸载检验和
以太网控制器会将IP分组,TCP/UDP数据报中的检验和卸载下来，硬件会自动计算，插入并且检测检验和，但是检验和的值是由软件提供的。
5. 缓冲和描述符结构
驱动会分配传输和接收缓冲，并且会形成一个描述符指向缓冲的地址和状态。驱动为硬件准备一个队列缓冲用来接收，一旦合法的数据包到达后，接收了数据的缓冲将为驱动所有。为了传输数据包，驱动自身会维护一个队列缓冲，当这个缓冲中数据已经可以准备发送时，驱动将会把这个缓冲提交给硬件，然后硬件接下来就会读取缓冲中的数据并且以FIFO的方式发送数据包。
描述符指定了1. 缓冲物理地址 2. 缓冲长度 3. 缓冲状态和命令信息 4. 指向数据包尾部的指针 5. 数据包的类型 6. 硬件需要对数据包的操作(VLAN或者卸载检验和)


# PCI 接口
E1000网卡是PCI(Peripheral Component Interconnect)设备，这意味着网卡是插在主板PCI总线上的，PCI总线包含了地址数据中断线，允许CPU和PCI设备进行交互，并且PCI设备能读写内存。PCI设备需要在使用前被发现并且初始化。

![pci.jpg]( /images/operating-system/6.828/lab6/pci.jpg)

发现过程就是通过遍历PCI总线寻找附加的设备，初始化过程就是分配I/O和内存空间并且商榷IRQ线的使用权。当找到设备的时候，可以读到设备的vendor ID和device ID。JOS中使用这两个键在`pci_attach_vendor`中找寻值。并且将这两个键组合成一个结构体，并包含一个回调函数执行设备初始化。
```
struct pci_func {
    struct pci_bus *bus;

    uint32_t dev;
    uint32_t func;

    uint32_t dev_id;
    uint32_t dev_class;

    uint32_t reg_base[6];
    uint32_t reg_size[6];
    uint8_t irq_line;
};
```
反映了初始化的寄存器，其中`reg_base`基地址寄存器BARs（Base Address Registers），`reg_size`应该类似于基地址偏移确认IO端口。

![BARs.png]( /images/operating-system/6.828/lab6/BARs.png)

当`pci_device`结构体中的函数被调用的时候，设备已经被发现了，但是仍没被启用。这意味着PCI仍然没有为设备分配资源，例如内存空间，IRQ线，基地址寄存器等在结构体中的信息也没有被填入，所以需要调用`pci_func_enable`来完成这些工作。

# 练习 3
实现一个附加函数去初始化E1000
如果在`pci_attach_vendor`数组找到了PCI设备，提供一个入口来触发初始化函数(确定该PCI键是放在{0, 0, 0}结束标志前的)。
`vendor ID`和`device ID`信息:

![82540EM.png]( /images/operating-system/6.828/lab6/82540EM.png)

然后通过`pci_func_enable`函数来启动pci设备，完成`kern/e1000.c`和`kern/e1000.h`
启动时先从`i386_init`开始执行到`pci_init`，再紧接着调用`pci_bus_scan`将总线中的设备扫描出来，并且把这些信息存到一个临时的`pci_func`结构体中，最后调用`pci_attach`函数在`pci_attach_class`或者`pci_attach_vendor`用vendorID和DeviceID找寻相应的attach function并且调用这个回调函数。
`pci_attach_match`
``` C
   if (list[i].key1 == key1 && list[i].key2 == key2) {
        int r = list[i].attachfn(pcif);
```
这里就是在list(class或者vendor数组)用键索引，然后调用`attachfn`来完成启动。

## e1000.c
```
#include <kern/e1000.h>

// LAB 6: Your driver code here
//extern
struct pci_func;

int
e1000_attach(struct pci_func *pcif)
{
    pci_func_enable(pcif);
    return 1;
}
```

## pci.c
``` C
struct pci_driver pci_attach_vendor[] = {
    { 0x8086, 0x100e, &e1000_attach },
    { 0, 0, 0 },
};
```


# 内存映射IO
软件与E1000芯片通过MMIO(memory-mapped I/O)，之前已经接触过两次，CGA控制台和LAPIC，控制和请求都是通过读写这些内存。但是实际上这些读写操作不会通过DRAM，而是直接操作到设备上去。`init`过程中，JOS先执行的内存映射，也就是说之前映射这些IO内存的读写是通过bus(`?`)直接进行的，往LAPIC映射的内容写入值，就是发送IPC信息。

`pci_func_enable`选定一个合适的MMIO区域为E1000使用，并且存储基地址和偏移到BAR 0(`reg_base[0]`和`reg_size[0]`)中，然后这部分物理内存地址将会赋值给设备，和之前一样，MMIO区域通常是一个很高的物理地址，所以需要将其映射到MMIOBASE中，虽然LAB4中已经使用了这部分区域，但是设置了一个静态变量`static uintptr_t base`在映射之后会自增映射后的大小，保证不会被重写覆盖。

# 练习4
在attach function中，通过调用为E1000的BAR 0创建一个虚拟内存的映射

``` C
struct pci_func;
extern void *mmio_map_region(physaddr_t, size_t);

int
e1000_attach(struct pci_func *pcif)
{
    volatile uint32_t *mmio_e1000;

    //negotiates an MMIO region
    pci_func_enable(pcif);

    //map to MMIOBASE
    mmio_e1000 = mmio_map_region(pcif->reg_base[0], pcif->reg_size[0]);
    cprintf("base: %x size: %x \n", pcif->reg_base[0], pcif->reg_size[0]);
    cprintf("E1000 STATUS REGISTER VALUE: %x\n", *(mmio_e1000+2));
    return 1;
}
```
`pci_func_enable`已经填入了合适的地址到了BAR0中去了，简单调用mmio_e1000就好。文件`kern/pcireg.h`中的状态寄存器偏移为0x04但是Hint提供的偏移是0x08,验证后是后者正确。
映射的地址指针应该声明为`volatile`，防止编译器优化让缓存记录访问改地址的值。
文档Table 13-5指出了该寄存器的6,7位的值表达了最大传输速度，1000MB/s对应的位设置应该`10`与`0x80080783`转换为二进制后6，7位的值相同。


# DMA
传输数据包通过读写上个练习中被映射的内存块是一种办法，但是这样太慢了，因为E1000自身需要缓冲包数据。所以E1000使用直接内存访问DMA(Direct Memory Access)来进行内存读写而不需要唤醒CPU。
CPU首先初始化数据传输，然后CPU去执行其他操作，当数据接收完后从DMA控制器发送一个中断告诉CPU已经传输完成了，这样就可以达到异步传输，从而提高处理速度。
驱动为传输和接收队列分配内存，设置DMA描述符，并让E1000定位这些队列，所以接下来的任务将会是异步执行。
为了发送数据包，驱动程序将会复制数据包到在传输队列的下一个DMA描述符中去并且告诉E1000有数据包可以进行发送了，E1000会在空闲状态的时候将数据从描述符中复制出来。相同地，当E1000接收到了数据包，E1000将数据复制到接收队列的下一个DMA描述符去，驱动有机会便会读取这个数据包对应的描述符。
接收和传输队列是非常相似的，都是由描述符序列组成，虽然这些描述符的确切结构各不相同，但每个描述符都包含一些标志和包含分组数据的缓冲区的物理地址。队列由环形数组组成，实现着队列用到的head pointer 和 tail pointer以及数据包缓冲的地址都必须是`物理地址`，因为硬件直接使用DMA访问内存而不会通过MMU。


# 发送数据包
E1000的接收功能和发送功能是相互独立的，首先必须为发送数据包初始化网卡，接下来的步骤在手册`section 14.5`。
1. 设置传输队列
2. 精确的结构体设置在章节`section 3.4`，描述符的结构体的设置在`section 3.3.3`
3. 暂时不关系TCP的卸载特性，只需要关注`遗留传输描述符格式(legacy transmit descriptor format)`

# C 结构体
使用C结构体描述E1000结构是很方便的，像之前的`Trapframe`结构体能够精确的安置数据在内存中，并且能在不同数据域填充空字节，虽然e1000没有这样的问题。如果遭遇了域对齐的问题，查看GCC的`packed attribute`。
合法传输描述符应该如下:
``` C
  63            48 47   40 39   32 31   24 23   16 15             0
  +---------------------------------------------------------------+
  |                         Buffer address                        |
  +---------------+-------+-------+-------+-------+---------------+
  |    Special    |  CSS  | Status|  Cmd  |  CSO  |    Length     |
  +---------------+-------+-------+-------+-------+---------------+
```
驱动应该为传输描述符数组和描述符所指的数据包缓冲保留内存空间，例如将描述符结构体声明为一个全局变量。
最简单的办法去处理数据包缓冲区是在驱动初始化的时候为数据包缓冲保留空间，将复制的数据包复制到这个预先分配的缓冲区中。以太网包最大大小为`1518`字节，缓冲区应该分配这么多。很多复杂先进的驱动能够动态分配缓冲区缓冲(能够在网络利用率很低的时候减少内存消耗)，甚至直接在用户态下提供缓冲。

# 练习5
实现14.5中的初始化步骤，13节提供了初始化步骤中的寄存器信息。
3.3.3和3.4提供传输描述符和传输描述符数组。

`初始化传输`
1. 为传输描述符链分配一个内存区域，并且需要保证这部分内存是16byte内存对齐。
2. 设置传输描述符基地址寄存器`TDBAL/TDBAH`(Transmit Descriptor Base Address)，32位只使用TDBAL。
3. 设置传输描述符长度寄存器`TDLENR`保存描述符环的大小，值必须是128字节对齐的
4. 传输描述符头尾寄存器`TDH/TDT`在加电后被硬件或者以太网控制器初始化为0B，驱动需要确认写入了0B到这两个寄存器。
5. 初始化传输控制寄存器`TCTL`
    - TCTL.EN(enable)置为1b
    - TCTL.PSP(Pad Short Packet)置为1b
    - 配置碰撞阈值TCTL.CT(Collision Threshold)为以太网标准值10h，半双工模式(half duplex mode)
    - 配置碰撞距离TCTL.COLD，全双工设置为40h，1000Mb/s半双工的值应该为200h，10/100Mb/s的值应该设置为40h

6. 配置Transmit IPG寄存器，设置为最小合法数据包间隔`legal Inter Packet Gap`。

``` C
struct TD transmit_desc_list[32] __attribute__ ((aligned (PGSIZE))) = { 0 };
struct packet buffer[32] __attribute__ ((aligned (PGSIZE))) =  { 0 };
#define PBUFSZ 2048
volatile uint32_t *mmio_e1000;


int
e1000_attach(struct pci_func *pcif)
{

    //negotiates an MMIO region
    pci_func_enable(pcif);
    desc_init();

    //map to MMIOBASE
    mmio_e1000 = mmio_map_region(pcif->reg_base[0], pcif->reg_size[0]);
    cprintf("base: %x size: %x \n", pcif->reg_base[0], pcif->reg_size[0]);
    cprintf("E1000 STATUS REGISTER VALUE: %x\n", *(mmio_e1000+2));

    //ex5: transmition initilizes
    transmit_init();

    return 1;
}

static void
desc_init()
{

    int i;
    for(i = 0; i < 32; ++i) {
        memset(&transmit_desc_list[i], 0, sizeof(struct TD));
        transmit_desc_list[i].addr = PADDR(&buffer[i]);
        transmit_desc_list[i].status = TXD_STAT_DD;
    //  transmit_desc_list[i].cmd =  TXD_CMD_RS | TXD_CMD_EOP;
    }

}

int
transmit_init()
{
    //TD Base Address register
    pciw(E1000_TDBAL, PADDR(transmit_desc_list));
    pciw(E1000_TDBAH, 0);

    //TD Descriptor Length register
    pciw(E1000_TDLEN, 32 * sizeof(struct TD));

    //TD head and tail register
    pciw(E1000_TDH, 0x0);
    pciw(E1000_TDT, 0x0);

    //TD control register
    pciw(E1000_TCTL, TCTL_EN | TCTL_PSP | (TCTL_CT & (0x10 << 4)) | (TCTL_COLD & (0x40 << 12)));

    //Transmit Inter Packets Gap register
    pciw(E1000_TIPG, 10 | (8 << 10) | (12 << 20));
    return 0;
}

```


现在传输已经被初始化了，需要完成一部分代码使得用户空间能通过系统调用发送数据包。为了传输数据包，必须将数据包放在传输队列的尾部，即复制数据包的数据到下一个数据包的缓冲并且更新TDT寄存器告知网卡已经有另外一个数据包在传输队列中了。(TDT是传输描述符数组的索引，不是字节偏移)

然而，传输队列只有这么大，传输队列可能会完全被塞满。为了检测这种情况，需要从E1000芯片中获取一些反馈。文档说明TDH寄存器是不知道信任的，但是如果设置了在传输描述符CMD域RS bit位，接下来，当网卡已经发送了这个描述符的数据包后，网卡将会设置文件描述符状态域的DD比特位，那么这很安全去回收这个描述符，并且使用这个描述符去传输另一个包。

如果用户调用传输系统调用，但是下个描述符没有设置DD比特位，接下来的代码需要解决这种情况，可以仅仅通过丢弃这个包来实现。网络协议能够恢复部分(重传)，但是如果一瞬间丢掉了大量的包，网络协议将可能不能恢复。取而代之的方法是需要告诉用户环境需要重新尝试，就像之前完成的`sys_ipc_try_send`。

# 练习6
完成一个函数传输数据包通过检测下一个描述符是否被释放，复制数据包数据到下一个描述符，更新TDT。保证你解决了当传输队列还是满的情况。

``` C
int
transmit(void *addr, size_t len)
{
    uint32_t tail = mmio_e1000[E1000_TDT];
    struct TD *next_desc = &transmit_desc_list[tail];

    if ((next_desc->status & TXD_STAT_DD) != TXD_STAT_DD)
        return -1;
    if (len > PBUFSZ)
        len = PBUFSZ;

    memmove(&buffer[tail], addr, len);
    next_desc->length = len;
    next_desc->status &= !TXD_STAT_DD;
    mmio_e1000[E1000_TDT] = (tail+1) % 32;
    cprintf("status register value: %x\n", *(mmio_e1000+2));
    cprintf("send : %s\n", addr);
    return 0;

}
```

现在可以检测传输代码。发送少量包直接通过内核调用传输函数。使用`make E1000_DEBUG=TXERR,TX qemu`去测试，能够看到
*e1000: index 0: 0x271f00 : 9000002a 0*作为传输包。每一行都会给出传输数组的索引，传输描述符的缓冲地址，`cmd/cso/length`和`special/css/status`域。
当QEMU允许的时候，执行`tcpdump -XXnr qemu.pcap`查看发送出去的数据包内的数据。
可以在monitor.c中添加一个测试函数，执行发送函数。执行完后，E1000的DEBUG命令回自动保存这个流量包到qemu.pcap文件中。

![pcap.png]( /images/operating-system/6.828/lab6/pcap.png)


# 练习7
为数据包的传输创建一个系统调用，并且检查传输过去的指针。

`lib/syscall.c`
``` C
int
sys_transmit(void *addr, size_t len)
{
    return syscall(SYS_transmit, 1, (uint32_t)addr, len, 0, 0, 0);
}
```

`kern/syscall.c`
``` C
// transmit packets
// return -1 if the transmition failed.
static int
sys_transmit(void *addr, size_t len)
{
    user_mem_assert(curenv, addr, len, PTE_U);
    return transmit(addr, len);
}
```

---

sudo apt-get remove --auto-remove qemu-system-x86
git clone http://web.mit.edu/ccutler/www/qemu.git -b 6.828-2.3.0

网络服务器
现在拥有了一个系统调用的接口从设备驱动这端传输数据，现在可以用来发送数据包了。这个输出帮助环境的目标是做接下来这个循环：接收`NSREQ_OUTPUT` 来自网络服务器内核的IPC消息和利用前面写的系统调用来发送IPC消息。
`NSREQ_OUTPUT` IPC消息由`low_level_output`函数来发送，依附于LwIP栈。每一个IPC都会包含一个由`union Nsipc`和`struct jif_pkt`组成。
结构体`jif_pkt`中的`jp_len`表示了数据包的长度。所有接下来的字节是数据包的内容。这个长度为0的数组一C语言的一个小技巧，就好像jp_data就是指向结构体的末尾，因为缓冲区是没有提前声名长度的。因为C语言不会做数组边界检查，只要保证在这个结构体后面有足够的未使用的内存，就能使用jp_data来指定任意数组大小。
注意当传输队列中没有足够的空间的时候，设备驱动，输出环境和网络服务内核的交互。网络服务内核利用IPC发送数据包到输出环境。如果输出环境环境因为设备驱动没有足够的缓冲而被暂停，那么网络服务将会被阻塞直到输出环境接收了IPC调用。

# 练习8
实现net/output.c中的功能

``` C
void
output(envid_t ns_envid)
{
    binaryname = "ns_output";

    union Nsipc output;
    int perm;
    envid_t envid;
    // LAB 6: Your code here:
    //  - read a packet from the network server
    //  - send the packet to the device driver

    while (1) {
        if (ipc_recv(&envid, &nsipcbuf, &perm) != NSREQ_OUTPUT)
            continue;
        while (sys_transmit(nsipcbuf.pkt.jp_data, nsipcbuf.pkt.jp_len) < 0);
    }

}
```

使用`tcpdump`打开pcap.qemu，这样就能看到发出ARP数据包。

![arp.png]( /images/operating-system/6.828/lab6/arp.png)

---
>Q1:How did you structure your transmit implementation? In particular, what do you do if the transmit ring is full?
在循环队列中不断检测下一个描述符的位置是否合法，通过while循环多次访问直到空闲。

PartB: 接收数据包
就像发送数据包，现在将配置E1000芯片来接收数据包并且提供接收描述符队列和接收描述符。手册3.2章节描述了数据包如何工作，包括接收队列结构体和接收描述符，以及初始化进程的细节(章节14.4)。

# 练习9
阅读手册3.2章节
通常数据的接收需要识别在线缆上的数据包，过滤地址，以FIFO方式存储数据，从接收缓存传输到主存中去，并且更i新年接收描述符。

1. 包地址过滤
    硬件存储即将到来的包到主存中通过过滤规则管理。如果没有足够的空间，硬件将会选择丢弃数据包，并且指出这个数据包丢失了。一般来说，只有号的数据包被接收，比如数据包没有CRC错误，符号错误，队列错误，长度错误，对齐错误等等。当然，如果设置了相关控制寄存器(RCTL.SBP)，那么这些坏包能被接收到(RDESC.ERRORS)接收描述符中。
2. 接收描述符
    ![rd.png]( /images/operating-system/6.828/lab6/rd.png)
    一旦数据包被以太网控制器接收了，硬件将会存储数据包到指定的缓冲并且填写长度，包的检验和，状态，错误等状态域。长度是整个被写入缓冲区的长度包括CRC校验位。软件必须读取多个描述符确认数据包是完整的。
3. 接受描述符状态域
    状态信息指出描述符是否被使用了和相关的缓冲是否是数据包的最后一个。
4. 捕捉接收描述符
    描述符捕捉策略是被设计去支持通过PCI总线的大量数据包的。捕捉算法尝试去最大利用PCI带宽通过缓冲线。
    当一个芯片缓冲区是空的，一旦任意描述符可以使用，一次捕捉将会发送，软件将会写入到tail指针。当缓冲区几乎要空的时候，只要有足够的有效描述符就会执行一次预先捕捉并且没有其他更高优先级的PCI活动。
    ![fetch.png]( /images/operating-system/6.828/lab6/fetch.png)
5. 回写接收描述符的避免
    关于回写:
　　一种称为“穿透”(Write-Through)模式，在这种模式中高速缓存对于写操作就好像不存在一样，每次写时都直接写到内存中，所以实际上只是对读操作使用高速缓存，因而效率相对较低。
　　另一种称为“回写”(Write-Back)模式，写的时候先写入高速缓存，然后由高速缓存的硬件在周转使用缓冲线时自动写入内存，或者由软件主动地“冲刷”有关的缓冲线。
1. 接收描述符队列结构
    软件通过写到队尾指针来添加有效的描述符，当一个数据包到达的时候，硬件将会存储这个数据包，并且自增头指针。当头指针域尾指针相等的时候，队列环就处于空的状态。硬件停止存储数据包到系统内存中直到然间前进了尾指针，让更多接收缓冲可用。
   ![ring.png]( /images/operating-system/6.828/lab6/ring.png)
    头尾指针分别引用一个16Bytes的内存块。
    图中阴影部分表示描述符已经存储了到来的数据包但是未被软件识别。
2. 地址过滤器
    MAC：mac地址过滤器检测MAC目的地址来保证该地址是否有效，接收配置的设置决定了哪一个物理地址被接收。
    IPv4：检测有效的IPv4头，域值应该为4.
    UDP/TCP:检测合法的UDP/TCP头，原型值分别为11h和06h。
    SNAP/VLAN/IPv6
接收队列与传输队列非常相似，除了接收队列需要等待被即将到来的数据包填满。因此，当网络是空闲状态的时候，传输队列应该是空的，而接收队列的缓冲区应该是满的(尾指针和头指针相等)。
当E1000芯片就收到了数据包，首先检测器是否满足网卡配置的过滤规则。否则，E1000会尝试从接受队列中取回下一个接收描述符。如果头指针已经等于了尾指针，那么说明接收兑率已经没有空闲的描述符，所以会丢弃数据包。如果有空闲的描述符，将会复制数据包数据到描述符所指到的缓冲区，并且设置描述符DD域和EOP域的状态比特位，并且自增头指针。
E1000如果接收到了一个数据包大于一个接受描述符的数据包缓冲，那么将会尽可能多的从接收队列中获取描述符并且存储完整的数据包内容。为了指出这种情况发生了，那么这个数据包所用的描述符都会标记DD比特位，但是EOP状态为只有最后一个描述符标记了。你能处理这种可能发生的可能性，也可以简单地不接受这种大数据包来保证所接收到缓冲区的数据包不会大于标准的以太网数据包1518字节。

# 练习10
设置好接受队列并且根据手册14.4章节配置E1000(跳过中断和CRC)
默认情况下，网卡会过滤所有的数据包，所以必须去配置接收地址寄存器拥有一个MAC地址为了让数据包能够寻址到该网卡。可以使用QEMU默认的MAC地址52:54:00:12:34:56，MAC地址的字节序是从低序写到高序的，所以52:54:00:12在低32比特，而34:56在高16位。
E1000只支持一个特定的接收缓冲区大小，如果数据包缓冲区足够大并且禁用了长数据包的接收，你不用担心数据包旋转在多个接收缓存。就像传输队列，数据缓冲必须是连续的物理内存。
这里必须使用至少128接收描述符。

1. 设置地址接收寄存器为QEMU的MAC地址，**从左往右代表从低到高字节序**，并且需要设置RAH寄存器的‘Address valid’标志位。
2. 设置接收循环队列的基地址寄存器RDBAH/RDBAL
3. 设置描述符长度寄存器RDLEN
4. 设置队列头尾指针，**与传输队列不同，接收队列的头指针与尾指针相等代表没有描述符可用，会发生丢包的情况**
5. 设置一些相关的控制寄存器。


`接收描述符`
``` C
struct RD {
    uint64_t addr;
    uint16_t length;
    uint16_t checksum;
    uint8_t status;
    uint8_t errors;
    uint16_t special;
}__attribute__((packed));

```

``` C
//same as lapicw(), read after write.

int
e1000_attach(struct pci_func *pcif)
{

    //negotiates an MMIO region
    pci_func_enable(pcif);
    desc_init();

    //map to MMIOBASE
    mmio_e1000 = mmio_map_region(pcif->reg_base[0], pcif->reg_size[0]);
    cprintf("base: %x size: %x \n", pcif->reg_base[0], pcif->reg_size[0]);
    cprintf("E1000 STATUS REGISTER VALUE: %x\n", *(mmio_e1000+2));

    //ex5: transmition initilizes
    transmit_init();

    //ex10: reception inistiizes
    recv_init();


    return 1;
}


static void
desc_init()
{

    int i;
    // transmit
    for(i = 0; i < 32; ++i) {
        memset(&transmit_desc_list[i], 0, sizeof(struct TD));
        transmit_desc_list[i].addr = PADDR(&buffer[i]);
        transmit_desc_list[i].status = TXD_STAT_DD;
        transmit_desc_list[i].cmd =  TXD_CMD_RS | TXD_CMD_EOP;
    }
    // receive
    for (i = 0; i < RECVNUM; ++i) {
        memset(&recv_desc[0], 0, sizeof(struct RD));
        recv_desc[i].addr = PADDR(&rbuf[i]);
        recv_desc[i].status = RXD_STAT_DD | RXD_STAT_EOP;

    }

}

int
recv_init()
{
    //Receive Address Register
    //pciw(E1000_RA, 0x52540012);
    pciw(E1000_RA, 0x12005452);
    pciw(E1000_RA+1, 0x5634 | E1000_RAV);

    //Multicast Table Array
    for (int i = 0; i < 128; i++)
        pciw(E1000_MTA+i, 0);
    //Base Address register
    pciw(E1000_RDBAL, PADDR(recv_desc));
    pciw(E1000_RDBAH, 0);

    // Descriptor Length
    pciw(E1000_RDLEN, sizeof(struct RD) * RECVNUM);

    // head and tail register
    pciw(E1000_RDH, 0);
    pciw(E1000_RDT, RECVNUM-1);

    pciw(E1000_RCTL, RCTL_EN | RCTL_LPE | RCTL_LBM_NO | RCTL_SZ_2048 | RCTL_SECRC);

    return 0;
}

```

完成这部分驱动后，即使没有完成接收数据包的代码，运行`make E1000_DEBUG=TX,TXERR,RX,RXERR,RXFILTER run-net_testinput`将会发送一个ARP数据包可以看到如下的内容。

![recv_arp.png]( /images/operating-system/6.828/lab6/recv_arp.png)

现在已经准备好了来接收数据包，为了能够接收到一个数据包，你的驱动将会跟踪下一个已经接收到了数据包的下一个描述符。和传输一样，文档所陈述的RDH寄存器不可以信赖，所以为了知道一个数据包已经被分发，必须读取描述符的DD状态位。如果DD位被被设置了，那么就能复制数据包的数据到描述符缓冲区，并且告诉E1000描述符已经空闲通过自增队列的尾指针。

如果DD比特位没有被设置，那么就没有数据包被接收了，这等于当传输队列是满的情况。面对这种情况，可以返回一个重试的错误信息，要求调用者重新尝试。虽然这种方法适合全满的传输队列，因为这是一个瞬时情况，但是不太适合空的接收队列，因为接收队列可能长时间出去一个空队列状态。第二种途径就是暂停调用的环境知道有数据包在接受队列中需要处理。这种策略与`sys_ipc_recv`非常相似，就像IPC的情况，因为每个CPU只会拥有一个内核栈，一旦离开内核，那么这个内核栈将会丢失。所以需要设置一个FLAG指出这个环境已经被接收队列暂停了并且记录系统调用的参数。这种方法的确定是很复杂的，E1000必须只是去省常接收中断并且驱动必须恢复被阻塞而等待的环境。

# 练习11
完成一个函数从E1000接收数据包并且添加一个用户环境能使用的系统调用。

``` C
int
recv(void *addr,size_t len)
{
    uint32_t tail = (mmio_e1000[E1000_RDT] + 1) % RECVNUM;
    struct RD *next_desc = &recv_desc[tail];
    //cprintf("tail value :%d\n", tail) ;


    if ((next_desc->status & RXD_STAT_DD) != RXD_STAT_DD)
        return -1;
    if (next_desc->length < len)
        len = next_desc->length;

    memcpy(addr, &rbuf[tail], len);
    next_desc->status &= !RXD_STAT_DD;
    mmio_e1000[E1000_RDT] = tail;
    return next_desc->length;
}
```


# 网络服务的接收数据包
再网络服务的输入环境中，需要使用新的接收心痛调用来接收数据包并且传递到网络服务的核心环境通过使用`NSREQ_INPUT` IPC消息，这些IPC消息需要有一个页面附加一个`union Nsipc`，数据包来填充其`struct jif_pkt`域。

# 练习12
完成 net/input.c
``` C
#define RDBUF 10
void
input(envid_t ns_envid)
{
    binaryname = "ns_input";

    // LAB 6: Your code here:
    //  - read a packet from the device driver
    //  - send it to the network server
    // Hint: When you IPC a page to the network server, it will be
    // reading from it for a while, so don't immediately receive
    // another packet in to the same physical page.


    int i, r;
    struct jif_pkt *head, *pkt = (struct jif_pkt*)&nsipcbuf;
    // 10 buffers
    for (i = 0; i < RDBUF; ++i)
        if ((r = sys_page_alloc(0, (void *)((uint32_t)pkt + i * PGSIZE), PTE_U | PTE_P | PTE_W)) < 0)
            panic("alloc error");

    i = 0;
    head = pkt;
    while (1) {
        while((r = sys_recv((void *)((uint32_t)pkt + sizeof(pkt->jp_len)), PGSIZE - sizeof(pkt->jp_len))) < 0) {
            sys_yield();
        //  cprintf("return value: %d\n", r);
        }
        //cprintf("pkt : %x | [i] : %d  \n", pkt, i);
        pkt->jp_len = r;
        ipc_send(ns_envid, NSREQ_INPUT, pkt, PTE_P | PTE_U);
        pkt = (struct jif_pkt *)((uint32_t)pkt + PGSIZE);
        if (i++ == RDBUF-1) {
                pkt = head;
                i = 0;
        }
    }

}
```

运行`make E1000_DEBUG=TX,TXERR,RX,RXERR,RXFILTER run-net_testinput`能够收到下面这个消息
```
Sending ARP announcement...
Waiting for packets...
e1000: index 0: 0x26dea0 : 900002a 0
e1000: unicast match[0]: 52:54:00:12:34:56
input: 0000   5254 0012 3456 5255  0a00 0202 0806 0001
input: 0010   0800 0604 0002 5255  0a00 0202 0a00 0202
input: 0020   5254 0012 3456 0a00  020f 0000 0000 0000
input: 0030   0000 0000 0000 0000  0000 0000 0000 0000
```
*testinput只会发送一个数据包，但是评分脚本会有5个数据包*
为了更加深入测试网络代码，JOS提供了一个叫做`echosrv`的守护进程来设置回显服务通过TCP服务的端口7。
>Q2: How did you structure your receive implementation? In particular, what do you do if the receive queue is empty and a user environment requests the next incoming packet?

结构体的的定义根据手册来定义就行，如果接收队列是空的，那么该环境自己放弃时间片，调用调度算法，等下一个时间片周期再来检测是否有数据包。

# 网页服务
网页服务以其最简单的形式发送内容给请求的客户端。JOS已经一共了非常简单的网络服务在`user/httpd.c`中。这个代码框架解决了即将到来的连接并且解析HTTP头。

# 练习13
网络服务缺失了发送内容到客户端的代码，完成send_file和send_data。

``` C
static int
send_data(struct http_request *req, int fd)
{
    // LAB 6: Your code here.
    //panic("send_data not implemented");
    int r;
    char buf[512];

    while ((r = read(fd, buf, 512)) > 0)
        if (write(req->sock, buf, r) != r)
            return -1;
    return 0;
}

static int
send_file(struct http_request *req)
{
    int r;
    off_t file_size = -1;
    int fd;
    struct Stat fst;

    // open the requested url for reading
    // if the file does not exist, send a 404 error using send_error
    // if the file is a directory, send a 404 error using send_error
    // set file_size to the size of the file

    // LAB 6: Your code here.
    //cprintf("url: %s \n", req->url);
    //panic("send_file not implemented");
    if ((fd = open(req->url, O_RDONLY)) < 0)
        return send_error(req, 404);

    if ((r = fstat(fd, &fst)) < 0)
        return send_error(req, 404);

    file_size = fst.st_size;

    if (fst.st_isdir)
        return send_error(req, 404);


    if ((r = send_header(req, 200)) < 0)
        goto end;

    if ((r = send_size(req, file_size)) < 0)
        goto end;

    if ((r = send_content_type(req)) < 0)
        goto end;

    if ((r = send_header_fin(req)) < 0)
        goto end;

    r = send_data(req, fd);

end:
    close(fd);
    return r;
}

```

从最开始的概览图可以知道，这里是属于用户环境的程序，`struct http_request`中的socket相当于一个文件描述符，当把内容写到这个文件缓冲区，并且调用文件系统的回调函数，网络服务核心发送IPC消息到输出辅助环境。最开始接收到数据包的适合，利用`http_request_parse`函数获取文件路径，然后这个程序尝试去打开文件看能否打开，来判断文件的存在。然后发送HTTP头，HTTP头大小，类型以及`\r\n`的http头结束符。最后再将HTTP包主体传过去，也就是通过URL所指定的文件。


最后可以通过浏览器访问这个网站

![web.png]( /images/operating-system/6.828/lab6/web.png)

# make grade
```
make[1]: Leaving directory '/home/moonlight/lab'
testtime: OK (9.9s)
pci attach: OK (1.7s)
testoutput [5 packets]: OK (3.1s)
testoutput [100 packets]: OK (2.8s)
Part A score: 35/35

testinput [5 packets]: OK (3.1s)
testinput [100 packets]: OK (2.2s)
tcp echo server [echosrv]: OK (2.6s)
web server [httpd]:
  http://localhost:26002/: OK (1.8s)
  http://localhost:26002/index.html: OK (1.8s)
  http://localhost:26002/random_file.txt: OK (2.8s)
Part B score: 70/70

Score: 105/105
```



>  **you have a file system, no self respecting OS should go without a network stack.**