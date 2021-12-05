---
title: '6.828-操作系统工程-Lab1:Booting a PC'
categories:
  - sys
date: 2018-03-14 21:08:44
tags:
  - OS
---

>3月14日 - 3月28日


## Exercise 1
熟悉x86汇编和AT&T汇编


16-bit intel 8088
1MB = 1048576bit
内存地址: 0x00000 ~ 0xFFFFF
640KB(0x00000 ~ 0xA0000) 用户可用
[参考资料](http://web.archive.org/web/20040322145608/http://members.iweb.net.au:80/~pstorr/pcbook/book2/memory.htm)

### GDB启动过程

首先打开一个终端到目的lab根文件夹
`$ make qemu-nox-gdb`
再打开一个新的终端窗口执行以下命令进行监听
`$ make gdb`

以及一些常用的gdb命令
b: 0xffff: 在0xffff出下断点
c: continue to breakpoint
si: 单步前进
x/5: 0xFFFFF
从0xFFFFF开始的5个命令

------
## Exercise 2
第一条指令:
	[f000:fff0] 0xffff0:	ljmp   $0xf000,$0xe05b
当处理器重置时，会进入实模式并将CS设置为0xf000，IP设置为0xfff0(CS:IP=0xffff0)。
这个地址与BIOS的结束位置0x100000差16bytes。


### 启动后追踪BIOS的部分代码
``` ARM
[f000:e05b]    0xffff0:	ljmp   $0xf000,$0xe05b
[f000:e05b]    0xfe05b:	cmpl   $0x0,%cs:0x6c48	;把0与cs:6c48所指向内存的值比较
[f000:e062]    0xfe062:	jne    0xfd2e1          ;与CS:0x6c48(f6c48)处的值与0比较，不是0跳转
[f000:e066]    0xfe066:	xor    %dx,%dx          ;dx清0
[f000:e068]    0xfe068:	mov    %dx,%ss          ;ss置0,AT&T汇编mov指令反向
[f000:e06a]    0xfe06a:	mov    $0x7000,%esp     ;esp设置为0x7000,实模式引导区位置
[f000:e070]    0xfe070:	mov    $0xf3691,%executed ;edx设置为0xf3691
[f000:e076]    0xfe076:	jmp    0xfd165            ;跳转 0xfd165
[f000:d165]    0xfd165:	mov    %eax,%ecx
[f000:d168]    0xfd168:	cli                       ;屏蔽中断
[f000:d169]    0xfd169:	cld                       ;DF设置为0，指在每次传送一次将esi和edi自动+1;std将DF设置为1,传送自减


[f000:d16a]    0xfd16a:	mov    $0x8f,%eax
[f000:d170]    0xfd170:	out    %al,$0x70          ;将al中的值0x8f输出到外部设备0x70端口,NMI不可屏蔽中断使能位为1
[f000:d172]    0xfd172:	in     $0x71,%al          ;将0x71端口的值输出到al,GDB查看寄存器信息看见eax值被清0

	;A20地址线使能,进入保护模式
[f000:d174]    0xfd174:	in     $0x92,%al
[f000:d176]    0xfd176:	or     $0x2,%al
[f000:d178]    0xfd178:	out    %al,$0x92

	;加载6个字节
[f000:d17a]    0xfd17a:	lidtw  %cs:0x6c38          ;加载中断向量表 ->idt寄存器
[f000:d180]    0xfd180:	lgdtw  %cs:0x6bf4          ;加载全局描述符表->gdt寄存器

	;cr0寄存器置为1，进入保护模式
[f000:d186]    0xfd186:	mov    %cr0,%eax
[f000:d189]    0xfd189:	or     $0x1,%eax
[f000:d18d]    0xfd18d:	mov    %eax,%cr0
	;重新加载全局描述符GDT
   0xfd190:	ljmpl  $0x8,$0xfd198
   0xfd198:	mov    $0x10,%ax
   0xfd19b:	add    %al,(%bx,%si)
   0xfd19d:	mov    %ax,%ds
   0xfd19f:	mov    %ax,%es
   0xfd1a1:	mov    %ax,%ss
   0xfd1a3:	mov    %ax,%fs
```

* [重新加载的]( https://en.wikibooks.org/wiki/X86_Assembly/Global_Descriptor_Table)
* [x86汇编复习](http://www.cs.virginia.edu/~evans/cs216/guides/x86.html)
* [外围设备端口](http://bochs.sourceforge.net/techspec/PORTS.LST)

### 软盘硬盘
磁盘的最小传输单元(sector)： 512bytes
16位机，在CD-ROM启动之前，后被扩展。xv6使用传统硬盘,512bytes/sector
boot sector 在开机时被读入物理地址为 0x7c00 ~ 0x7dff

------
## Exercise 3
1. 在0x7c00设置断点,对比源代码boot/boot.S，GDB，反汇编文件obj/boot/boot.asm
2. 跟随boot/main.c文件的bootmain()函数到readsect()函数，弄清楚readsect()中的指令直至返回到bootmain()，确认从磁盘中读取kernel的for循环。跟随到bootloader完成引导。

boot/boot.S: 源代码
obj/boot/boot.asm: 反汇编代码
boot/main.c: 加载kernel的C代码

------
### boot.S
打开/lab/boot可以看到一段注释，CPU启动后，切换至保护模式。BIOS把磁盘第一个扇区读入内存0x7c00处，并且在实模式下执行，将CS:IP指向0:7c00。
代码基本有注释，有几个点得注意下:

	inb     $0x64,%al               # Wait for not busy
	testb   $0x2,%al
	jnz     seta20.2

将外围设备0x64端口读1byte？到al中，0x64端口的第1位的 bit 1 = 1 input buffer full (input 60/64 has data for 8042)判断输入缓冲区是不是满的，再用test和jnz来循环等待。

	movb    $0xd1,%al               # 0xd1 -> port 0x64
	outb    %al,$0x64
下次下入0x60的数据将会写入804x控制器。

	movb    $0xdf,%al               # 0xdf -> port 0x60
	outb    %al,$0x60
0xdf写入到0x60中，让地址线A20使能，开启32位保护模式。

	lgdt    gdtdesc
加载全局描述表，具体见:http://www.cnblogs.com/fatsheep9146/p/5115086.html

	ljmp    $PROT_MODE_CSEG, $protcseg
关于这个跳转有一个好的解释如下图。
![IMG_3555.PNG]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/IMG_3555.PNG)
是保护模式下的跳转方法。

	movl    $start, %esp
esp的值设置为0x7c00,准备开始执行boot loader 。

------
### main.c

在这个文件内补充了一个启动过程和DISK的排布:
disk layout
1. boot.S和main.c是启动器，存储在磁盘的第一个扇区。
2. 第二个扇区存储内核镜像。
3. 内核镜像必须是ELF文件格式。
BOOT UP STEPS
1. CPU读取BIOS到内存中并且执行。
2. BIOS初始化设备，中断历程，并且读取第一个扇区并且跳转执行。
3. 如果boot loader存储在第一个扇区，那么cpu由其接管。
4. boot.S开启保护模式，设置栈空间，调用bootmain()。
5. 然后bootmain()接管cpu，读取内核并且跳转。


	#define ELFHDR          ((struct Elf *) 0x10000) // scratch space
ELFHDR为一个固定值 0x10000

	readseg((uint32_t) ELFHDR, SECTSIZE*8, 0);
把磁盘中的ELF文件头(512*8=4MB？待解决)读到内存0x10000

	ph = (struct Proghdr *) ((uint8_t *) ELFHDR + ELFHDR->e_phoff);
Proghdr结构体类型指针ph,指向Program Table表头

	eph = ph + ELFHDR->e_phnum;
指向表尾

	for (; ph < eph; ph++)
		readseg(ph->p_pa, ph->p_memsz, ph->p_offset);
根据这从磁盘读出的4MB ELF文件头，再从磁盘中读取ELF文件的数据段，代码段....

	((void (*)(void)) (ELFHDR->e_entry))();
暂时不清楚，跳到elf文件执行入口？

------

The ELF file contains headers that describe how these sections should be stored in memory .

> ELF文件: [/ELF文件/](/ELF.index)
> wiki-ELF: https://en.wikipedia.org/wiki/Executable_and_Linkable_Format

### GDB调试

------
#### readsect()
    7d15:       55                      push   %ebp
    7d16:       89 e5                   mov    %esp,%ebp
    7d18:       56                      push   %esi
    7d19:       53                      push   %ebx
保存寄存器信息

    7d1a:       6a 00                   push   $0x0
    7d1c:       68 00 10 00 00          push   $0x1000
    7d21:       68 00 00 01 00          push   $0x10000
    7d26:       e8 b1 ff ff ff          call   7cdc <readseg>
偏移0x0,大小0x1000(512x8),装载的内存地址0x10000

	7ce1:       8b 7d 10                mov    0x10(%ebp),%edi
	7ce5:       8b 75 0c                mov    0xc(%ebp),%esi
	7ce8:       8b 5d 08                mov    0x8(%ebp),%ebx
>因为此时的%ebp的值为0x7bdc，在这里面存放的是bootmain过程的%ebp值，0x04(%ebp)即0x7be0存>放的是bootmain的返回地址，0x08(%ebp)存放的是第1个输入参数0x10000，0xc(%ebp)存放的是第2>个参数0x1000，0x10(%ebp)中存放的是第3个参数0x00
//具体原因:(待)

执行完后ebx: 0x10000 esi: 0x1000 edi: 0x0

	7cee:       01 de                   add    %ebx,%esi
从内存的开始到第一个扇区的结束。

	7cf0:       47                      inc    %edi
edi+1

	7cf7:       39 f3                   cmp    %esi,%ebx
    7cf9:       73 12                   jae    7d0d <readseg+0x31>
while的判断条件。

	call readsect
	call waitdisk
	ret

------
#### outb()

返回后直接进入 outb()中

	outb(0x1F2, 1);         // count = 1
	outb(0x1F3, offset);
	outb(0x1F4, offset >> 8);
	outb(0x1F5, offset >> 16);
	outb(0x1F6, (offset >> 24) | 0xE0);
	outb(0x1F7, 0x20);

"通过这些指令可以看出，系统是先想0x1F2端口送入一个值1，代表取出一个扇区，然后向0x1F3~0x1F6中送入你要读取的扇区编号的32bit表示形式。最后向0x1F7端口输出0x20指令表示要读取这个扇区。"

------
#### insl()
	7cc9:       8b 7d 08                mov    0x8(%ebp),%edi
	7ccc:       b9 80 00 00 00          mov    $0x80,%ecx
	7cd1:       ba f0 01 00 00          mov    $0x1f0,%edx
edi = 0x10000 ecx = 0x80 edx = 0x1f0

	repnz insl (%dx),%es:(%edi)
repnz为装饰符，重复执行后面的语句，直到cx寄存器为0。
dx存要访问的端口，edi存要存放的内存起始地址。每次传输4字节
执行前

![IMG_3528.PNG]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/IMG_3528.PNG)

![IMG_3529.PNG]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/IMG_3529.PNG)

执行2次
![IMG_3527.PNG]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/IMG_3527.PNG)

直到ecx减为0，继续接下来的执行。这个时候从0x10000~0x100200(512字节)已经加载完成。
> GDB查看内存信息: x/12xb 0x10000

    7d09:       58                      pop    %eax
    7d0a:       5a                      pop    %edx
    7d0b:       eb ea                   jmp    7cf7 <readseg+0x1b>
把pa和end_pa拿出来，即while的条件比较。当pa = end_pa 跳出while。
设置断点到while结束

    7d0d:       8d 65 f4                lea    -0xc(%ebp),%esp
    7d10:       5b                      pop    %ebx
    7d11:       5e                      pop    %esi
    7d12:       5f                      pop    %edi
    7d13:       5d                      pop    %ebp
    7d14:       c3                      ret
恢复栈寄存器，返回到bootmain()

------
#### if判断
    7d2b:       83 c4 0c                add    $0xc,%esp
    7d2e:       81 3d 00 00 01 00 7f    cmpl   $0x464c457f,0x10000
    7d35:       45 4c 46
    7d38:       75 37                   jne    7d71 <bootmain+0x5c>
7d2b存疑
7d2e:文件在内存中起始地址内容与0x464c467f比较，ELF文件头标志，16进制数分别代表‘F’,'L','E',0X7F。
7d38在文件内容不符合的条件下跳转。

------
#### for循环读取
	7d3a:       a1 1c 00 01 00          mov    0x1001c,%eax
    7d3f:       0f b7 35 2c 00 01 00    movzwl 0x1002c,%esi
分别对应ph和eph,ph为ELF文件的Program Table Headers起始偏移，eph存入的是Program Table Headers的个数。

	7d46:       8d 98 00 00 01 00       lea    0x10000(%eax),%ebx
切换到Intel汇编是lea ebx,[eax+0x10000]，ebx = eax + 0x10000 。

	7d4c:       c1 e6 05                shl    $0x5,%esi
	7d4f:       01 de                   add    %ebx,%esi
设定Program Table Headers结束地址？


    7d55:       ff 73 04                pushl  0x4(%ebx)
    7d58:       ff 73 14                pushl  0x14(%ebx)
    7d5b:       83 c3 20                add    $0x20,%ebx
    7d5e:       ff 73 ec                pushl  -0x14(%ebx)
    7d61:       e8 76 ff ff ff          call   7cdc <readseg>
这四条指令应该可以理解为readseg(ebx+c,ebx+14,ebx+4)，类似于读取elf文件的第一个段，把磁盘的内容取到内存中去。操作系统内核到现在已经加载完成。

------
#### 内核跳转
	7d6b:       ff 15 18 00 01 00       call   *0x10018
	((void (*)(void)) (ELFHDR->e_entry))();
最后一步，转到内核的开始点。


> __BIOS启动->保护模式->读取第一个扇区到内存->跳转至0x7c00地址执行bootstrap->加载磁盘中的系统内核elf文件到0x10000 -> 最后跳转到内核开始处。__

------

### 问题
* At what point does the processor start executing 32-bit code? What exactly causes the switch from 16- to 32-bit mode?

	movl    %cr0, %eax
	orl     $CR0_PE_ON, %eax
	movl    %eax, %cr0
开启cr0寄存器最低位

* What is the last instruction of the boot loader executed, and what is the first instruction of the kernel it just loaded?
1. movl    $start, %esp ; bootloader开始地址压栈
2. push   %ebp ;准备readseg()的参数

* Where is the first instruction of the kernel?
0x1000c
* How does the boot loader decide how many sectors it must read in order to fetch the entire kernel from disk? Where does it find this information?
在elf文件中，首先宏定义了一个结构体指针指向elf文件在内存中的加载处，然后利用elf文件提供的信息加载Program table Headers所指定的信息。ELFHDR->e_phnum这个偏移加上基础地址就得到了文件头的个数。

## Exercise 4

### pointer.c

    c[1] = 300;
    *(c + 2) = 301;
    3[c] = 302;
第三个输出的地方，有一个没有接触过的数组访问方法
“3[c]”的结果和“c[3]”的结果一样，有点类似于at&t汇编中的  mov 0x3(%ebx),eax ，也许是衍生出来的一种形式。

	b = (int *) a + 1;
    c = (int *) ((char *) a + 1);
b为一个为整形指针，b的值+1，int指针的值+4
而c为char形，c值+1，char形指针+1

### ELF
查看文件头

	objdump -h obj/kern/kernel

	objdump -x obj/kern/kernel


kernel Program Header:

    LOAD off    0x00001000 vaddr 0xf0100000 paddr 0x00100000 align 2**12
         filesz 0x00007120 memsz 0x00007120 flags r-x
    LOAD off    0x00009000 vaddr 0xf0108000 paddr 0x00108000 align 2**12
         filesz 0x0000a300 memsz 0x0000a944 flags rw-
   STACK off    0x00000000 vaddr 0x00000000 paddr 0x00000000 align 2**4
         filesz 0x00000000 memsz 0x00000000 flags rwx

vadd(virturl address),paddr(physical address),LOAD(ELF object need to be loaded)
align的大小表示是我在用python的时候想起来的，2**n 表示的是 2^n次方。

## Exercise 5
> LOAD address and LINKER address

关于link address 和load address,我在网上找到这样一个说法:
load address，表示一个已确定对象的实际加载地址。如C中可执行程序的main函数的地址，在编译完成的时候其地址已经确认（当然在系统中这是一个逻辑地址）
link address，表示一个未确定对象的应该加载的地址。如你使用C动态库中的printf函数的地址。在编译完成的时候不能确定其地址，因为它的实体是在动态链接库中，只能给它规定一个应该加载的地址，在程序加载的时候才能真正确认是否可以加载在这个地址上（可能出现动态库找不到的情况，这时候就加载错误了）
![obj8.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/obj8.png)
VMA为link address,程序开始执行的地方；LMA为load address,将会被bootloader读取到的内存地址。

跟着这个[链接](http://www.cnblogs.com/fatsheep9146/p/5220004.html)，改变boot/Makefrag的文件内容，原文件内容

![obj1.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/obj1.png)

改-Ttext的参数，从0x7c00改为0x7e00

![obj2.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/obj2.png)

原boot.asm(make后产生的)变为

![obj3.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/obj3.png)

每个命令在这个asm文件内的地址都发生了变化。

跟踪bootstrap,设置断点在0x7c00,si执行几步。

![obj4.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/obj4.png)

![obj5.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/obj5.png)

lgdtw  0x7e64,本应该加载0x7c64的,但是内存区域内容没有内容

![obj6.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/obj6.png)

ljmp   $0x8,$0x7e32,这是跳转到保护模式程序段的跳转命令，但是跳转失败

![obj7.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/obj7.png)

我改变了boot/Makefrag中-Ttext的参数，把boot loader的link地址从0x7c00改成了0x7e00。由make命令从boot.S生成到boot.asm的文件中，命令的地址都发生了变化，但是BIOS默认读取boot到地址0x7c00，但是代码的性质，例如lgdtw加载全局描述符命令，已经发生了改变。代码本应被读到0x7e00执行，实际是在0x7c00执行，到最后一步一步的出错。

## Exercise 6

```bash
objdump -f obj/kern/kernel
```
得到内核ELF文件中程序入口 __0x0010000c__

这个练习的问题是：在0x7c00这个位置和在bootloader进入kernel的时候为什么从0x10000开始，8 word长的内存中内容不同？
因为bootloader已经readseg()这个函数的时候，将ELF从磁盘读到了0x10000这个地址了。
(还是没弄清如何确认读多少个扇区)

------

## Exercise 7

* kern/kernel.ld 存放link address 和load address
ld文件格式：https://www.math.utah.edu/docs/info/ld_3.html

entry_pgdir 将虚拟地址0xf0000000~0xf0400000 映射到 0x00000000~0x00400000

> 文件 kern/entry.S

根据练习的引导，将断点设置在mov eax,cr0处，查看0x00100000和0xf0100000的内存空间。
运行前：

![before.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/before.png)

运行后：

![next.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/next.png)


地址0xf0100000被映射成功了，与0x00100000地址处内容相同。

注释执行这个程序，往后面看几条汇编：

	0x100025:	mov    $0xf010002c,%eax
	0x10002a:	jmp    *%eax
程序将会跳转到0xf010002c这个地址去，但是用gdb查看这个地址并没有指令：

![f010002c.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/f010002c.png)

程序就会往非预期的方向前进。

------

## Exercise 8

阅读三个c文件：
__kern/printf.c
lib/printfmt.c
kern/console.c__

从文件名上猜测，printf文件应该是实现输出的主体，printfmt.c应该是一个写满方法的库，console.c应该和shell类似，输出内容和交互的主体。

### console.c

#### cons_putc()
先从cons_putc()函数开始，代码注释为输出字符到console界面，跟随这个走应该能了解到字符的输出过程。
``` C
static void
cons_putc(int c)
{
        serial_putc(c);
        lpt_putc(c);
        cga_putc(c);
}
```
跟随子程序：

#### serial_putc()

``` C
static void
serial_putc(int c)
{
	int i;

	for (i = 0;
	     !(inb(COM1 + COM_LSR) & COM_LSR_TXRDY) && i < 12800;
	     i++)
		delay();

	outb(COM1 + COM_TX, c);
}
```
COM1 + COM_LSR = 0x03FD ，COM_LSR_TXRDY = 0x20 = 0010 0000
根据这个[链接](http://bochs.sourceforge.net/techspec/PORTS.LST)查询端口，(inb(COM1 + COM_LSR) & COM_LSR_TXRDY)这一个判断条件就是取串口寄存器的第五位，判断transmitter holding register是否为空。
COM1 + COM_TX = 0X03F8
用for循环最多12800次来等待串口寄存器为空，然后执行outb，将参数 c 写入到串口transmitter holding register保存数据。

#### lpt_putc()
```c
static void
lpt_putc(int c)
{
	int i;

	for (i = 0; !(inb(0x378+1) & 0x80) && i < 12800; i++)
		delay();
	outb(0x378+0, c);
	outb(0x378+2, 0x08|0x04|0x01);
	outb(0x378+2, 0x08);
}
```
0378-037A 被叫做并行打印端口（parallel printer port）
0x378 : 数据端口 | 0x37A : 控制端口
!(inb(0x378+1) & 0x80) 用来判断端口是否闲置
outb(0x378+0, c); 写进数据端口？
接下来，对输出进行初始化等，具体不明确。
	bit 3 = 1  select printer
	bit 2 = 0  initialize printer
	bit 1 = 1  automatic line feed
	bit 0 = 1  strobe

#### cga_putc()
```c
static void
cga_putc(int c)
{
	// if no attribute given, then use black on white
	if (!(c & ~0xFF))
		c |= 0x0700;

	switch (c & 0xff) {
	...
	}
}
```
这种形式和颜色表示有关，一部分比特位控制背景颜色，一部分控制前景颜色，还有一部分负责字符数据。

[cga的相关注释](https://github.com/chyyuu/ucore_os_lab/blob/master/labcodes/lab1/kern/driver/console.c)

以及[what-is-the-function-of-0x0700-in-cga-putc](https://stackoverflow.com/questions/43221509/what-is-the-function-of-0x0700-in-cga-putc)


```c
if (crt_pos >= CRT_SIZE) {
	int i;

	memmove(crt_buf, crt_buf + CRT_COLS, (CRT_SIZE - CRT_COLS) * sizeof(uint16_t));
	for (i = CRT_SIZE - CRT_COLS; i < CRT_SIZE; i++)
		crt_buf[i] = 0x0700 | ' ';
	crt_pos -= CRT_COLS;
}
```
这段代码的作用当显示坐标超出了整个console的大小时进行的操作，先用memmove函数crt_buf + CRT_COLS复制crt_buf处，复制长度为CRT_SIZE - CRT_COLS，也就是把页面往上推了一行。然后在for循环中，将最后一行清空。

#### vprintfmt
vprintfmt(void (*putch)(int, void*), void *putdat, const char *fmt, va_list ap)
void (*putch)(int, void*): void (int, void* ) 类型函数指针
putdat: 输出字符地址的指针
fmt : 指向格式化字符串
ap：  额外的参数
printf(fmt, ap);

### print.c

```c
#include <inc/types.h>
#include <inc/stdio.h>
#include <inc/stdarg.h>


static void
putch(int ch, int *cnt)
{
        cputchar(ch);
        *cnt++;
}

int
vcprintf(const char *fmt, va_list ap)
{
        int cnt = 0;

        vprintfmt((void*)putch, &cnt, fmt, ap);
        return cnt;
}

int
cprintf(const char *fmt, ...)
{
        va_list ap;
        int cnt;

        va_start(ap, fmt);
        cnt = vcprintf(fmt, ap);
        va_end(ap);

        return cnt;
}
```
cprintf("string", arg1, arg2)这个函数的调用方法和printf相似，应该就是最终调用函数。
关于ap这个变量，由下面这个程序：
```c
#include <stdarg.h>
#include <stdio.h>

int sum(int, ...);

int main()
{
   printf("sum :%d\n",  sum(4, 15, 56, 10, 22) );
   return 0;
}

int sum(int num_args, ...)
{
   int val = 0;
   va_list ap;
   int i;
   printf("%d\n", num_args);

   va_start(ap, num_args);
   for(i = 0; i < num_args; i++)
   {
      val += va_arg(ap, int);
   }
   va_end(ap);

   return val;
}
```


* 补充十进制输出符号 “%o” 的代码片段

根据之前10进制的改就好了:

	num = getuint(&ap, lflag);
	base = 8;
	goto number

题目:
1. Explain the interface between printf.c and console.c. Specifically, what function does console.c export? How is this function used by printf.c?
printer.c中的函数是三个主要函数，cprintf()基本上算是c语言中printf()的复刻版，调用顺序：cprintf() -> vcprintf() -> putch() ,调用putch的时候就会发现会要用到console.c中接触底层的函数	serial_putc(c)判断串口为空，lpt_putc(c)判断并行读写？cga_putc(c)负责最后的输出。

2. Explain the following from console.c:
已分析。

3. For the following questions you might wish to consult the notes for Lecture 2. These notes cover GCC's calling convention on the x86.
Trace the execution of the following code step-by-step:

	int x = 1, y = 3, z = 4;
	cprintf("x %d, y %x, z %d\n", x, y, z);
* In the call to cprintf(), to what does fmt point? To what does ap point?
* List (in order of execution) each call to cons_putc, va_arg, and vcprintf. For cons_putc, list its argument as well. For va_arg, list what ap points to before and after the call. For vcprintf list the values of its two arguments.

	1.fmt-> "x %d, y %x, z %d\n" , ap 应该是 x,y,z的集合
	2.va_arg这个调用,是每次从ap这个list中取一个值，比如原来参数列表中有x, y, z三个参数, va_arg(ap, int)调用一次，就会取出一个参数x，原列表a中只剩y, z了
	参考链接：http://www.cnblogs.com/fatsheep9146/p/5070145.html
4. Run the following code.
    unsigned int i = 0x00646c72;
    cprintf("H%x Wo%s", 57616, &i);
	What is the output?
	The output depends on that fact that the x86 is little-endian. If the x86 were instead big-endian what would you set i to in order to yield the same output? Would you need to change 57616 to a different value?

``` C
while (1) {
	while ((ch = *(unsigned char *) fmt++) != '%') {
		if (ch == '\0')
			return;
		putch(ch, putdat);
	}
```

1.首先这一个循环输出所有普通字符，直到fmt指到 %(开始switch) 和 \0(结束输出) 符号，
2.先是'x'16进制格式

	case 'x':
		num = getuint(&ap, lflag);
		base = 16;

getuint函数:
``` C
static unsigned long long
getuint(va_list *ap, int lflag) {
	if (lflag >= 2)
		return va_arg(*ap, unsigned long long);
	else if (lflag)
		return va_arg(*ap, unsigned long);
	else
		return va_arg(*ap, unsigned int);
}
```
返回一个根据ap列表中的参数,类型由flag控制。flag的值由'l'来自增,例如: "ld" ,"lld"
再调用
	printnum(putch, putdat, num, base, width, padc);
这是个递归函数，根据base进制等参数输出数字。

3.再是'%s'格式,输出参数i所在地址的字符串。


57616 = 0xe110 ,所以会输出He110
x86是little-endian, i = 0x00646c72 , 实际在内存中存储是 72 6c 64 00 ,即 'r', 'l', 'd', '\0'
最后的输出结果应该为: "He110 Worlds"


4. In the following code, what is going to be printed after 'y='? (note: the answer is not a specific value.) Why does this happen?
    cprintf("x=%d y=%d", 3);

这个问题和va_arg调用有关
``` C
#include <stdarg.h>
#include <stdio.h>

int out_range(int, ...);

int main()
{
   out_range(2,11,2);
   return 0;
}

int out_range(int num, ...)
{
	int val = 0;
	int i;
	va_list ap;
	va_start(ap, num);
	for(i = 0; i < 3; ++i)
	{
		val = va_arg(ap, int);
		printf("%d\n",val);
	}

	va_end(ap);
}

### result
11
2
1577856

```
情况和数组越界类似。

## Exercise 9

内核什么时候初始化堆栈，堆栈在内存的什么地方，内核如何为堆栈保留空间，哪一个指针指向堆栈的结束处？
在内核的入口设置断点，跟随几条指令：
	mov    $0x0,%ebp
	mov    $0xf0110000,%esp
	call   0xf0100094 <i386_init>
esp指向栈顶指针,entry.S最后定义了bootstrap的大小KSTKSIZE = 8 * PGSIZE  = 8 * 4096 = 32KB
所以堆栈位于内存的0x0010800 ~ 0x0011000,堆栈向下增长,esp指向栈顶

## Exercise 10-12
每个函数调用时，父函数先将参数压栈，使用call命令的时候，将eip压栈。然后进入子函数的时候，将原来的ebp压栈，把esp赋值给ebp，此时两寄存器都指向同一个地址。
接下来，子函数为程序分配内存空间，栈向下增长，即将esp减去一个值。
内存结构就是：
```
+-----+
| ... |
+-----+
| arg3|
+-----+
| arg2|
+-----+
| arg1|
+-----+
| eip |
+-----+
| ebp |
+-----+<-(ebp)
|unkn |
+-----+<-(esp)
```

``` C
int
mon_backtrace(int argc, char **argv, struct Trapframe *tf)
{
    // Your code here.
    uint32_t *ebp = (uint32_t*)read_ebp();
    struct Eipdebuginfo info;
    cprintf("Stack backtrace:\n");
    for(; ebp != 0; ebp = (uint32_t*) *ebp)
    {
            cprintf("  ebp %x  eip %x  args %08x %08x %08x %08x %08x\n",
                     ebp, *(ebp+1), *(ebp+2), *(ebp+3), *(ebp+4), *(ebp+5), *(ebp+6));
            if(debuginfo_eip(*(ebp+1),&info) == 0)
                    cprintf("    %s:%d: %.*s+%d\n", info.eip_file,
                    info.eip_line, info.eip_fn_namelen,
                    info.eip_fn_name, *(ebp+1) - info.eip_fn_addr);
    }
    return 0;
}
```

接下来要补全debuginfo_eip()中二分查找行的操作，根据前面的代码和提示，补全代码。
stabs文档:http://www.sourceware.org/gdb/onlinedocs/stabs.html#Stab-Sections
``` C
stab_binsearch(stabs, &lline, &rline, N_SLINE, addr);
        if(lline <= rline)
        {
                info->eip_line = stabs[lline].n_desc;
        } else {
                return -1;
        }
```

最后一步是输出调试信息，debuginfo_eip()是通过结构体Eipdebuginfo的成员值来返回的。
这个结构体的定义在kern/kdebug.h中，根据结构体定义信息用cprintf输出就行了。练习最后提示了printf("%.*s",stringlength ,string)对练习中函数名输出有帮助。

`$ make grade`

![lab1grade.png]( http://py2h8wxnt.bkt.clouddn.com/operating-system/6.828/lab1/lab1grade.png)

## 总结
1. 开机时候，ip指向一个高地址，执行跳转命令到BIOS的程序段，通过BIOS将磁盘的Boot加载到内存地址0x7c00处。
2. Boot程序加载全局描述符，将外围设备使能。进入保护模式，将扇区已ELF文件形式存在的系统内核加载到物理地址0x10000处，再通过ELF文件的程序入口，跳转到内核。
3. 内核开始时候，打开分页操作，分配堆栈，并将物理地址从0x10000映射到虚拟地址0xf010000处。
4. 最后就是理解系统调用时，堆栈的变化，还有修改一些类似printf函数的功能。





