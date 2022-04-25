# 6.828-操作系统工程-Lab4:Preemptive Multitasking


在这个实验中，将会在多个用户环境同时运行时实现抢占式多任务。

>part A:为JOS添加多处理器的支持，实现round-robin scheduling和增加基础的用户环境管理的系统调用，例如创建和销毁用户环境，分配和映射内存中的内容。
>part B: 实现fork()函数，允许用户环境去添加一份自己环境的拷贝。
>part C: 添加进程间的通信IPC(inter-process communication)，允许不同的用户环境各自通信和同步；添加硬件时钟中断和抢占任务。



# 准备开始

`git`

    #git rest --hard FETCH_HEAD
    git add -u
    git commit -m ""
    git pull
    git checkout -b lab4 origin/lab4
    git merge lab3

confilcts in file `config/lab.mk`

# 源文件描述

    kern/cpu.h  Kernel-private definitions for multiprocessor support
    kern/mpconfig.c Code to read the multiprocessor configuration
    kern/lapic.c    Kernel code driving the local APIC unit in each processor
    kern/mpentry.S  Assembly-language entry code for non-boot CPUs
    kern/spinlock.h Kernel-private definitions for spin locks, including the big kernel lock
    kern/spinlock.c Kernel code implementing spin locks
    kern/sched.c    Code skeleton of the scheduler that you are about to implement

# PART A: 多处理器支持(Multiprocessor Support )和协作式多任务(Cooperative Multitasking)

首先，会扩展JOS，使其能在多处理器系统上运行。然后实现一些JOS内核的系统调用，使得用户环境能创建额外的环境。通过实现cooperative round-robin scheduling，允许内核能切换到不同的用户环境，使用户环境自身让出CPU资源。
然后再part C中，将会实现 preemptive scheduling，这种调度算法允许内核从一个超出分配时间片的用户环境重新获取CPU的控制权。

# Multiprocessor Support

JOS将会支持对称多处理SMP(symmetric multiprocessing)，这种多处理模型使得CPU能有对例如内存和IO总线等系统资源拥有平等的访问权。虽然所有的CPU在SMP中都一样，但是在执行启动进程期间，处理器会被分成两种。
1. 引导处理器BSP(bootstrap processor)在启动操作系统的时候，初始化系统的时候使用。
2. 应用程序处理器APs(application processos)仅当在操作系统已经启动好后，被BSP激活。
BSP处理器的选择取决于硬件和BIOS，到目前为止，JOS的代码都是运行在BSP处理器上的。

在SMP系统中，每个CPU都有一个附随的[LAPIC单元](https://en.wikipedia.org/wiki/Advanced_Programmable_Interrupt_Controller)(local APIC unit)，这些单元通过系统分发中断，LAPIC为其相关的CPU提供一个独一无二的标识符。
在这个实验中，将会使用LAPIC的以下功能：
- 通过读取APIC ID(LAPICT identifier)获取当前正在运行的CPU(`cpunum()`)
- 发送处理器之间的__STARTUP__中断IPI(interprocessor interrupt)当BSP启动APs的时候。
- 在part C中，LAPIC内置计时器去触发时钟中断，来支持抢占式多任务。

APIC(Adavanced Programmable Interrupt Controller)
chapter 8:https://pdos.csail.mit.edu/6.828/2017/readings/ia32/IA32-3A.pdf
Local APIC主要的作用分成两部分:
- 接收来自其他LAPIC的中断和外部的I/O APIC中断，或者发送中断。
- 在MP(multiple processor)系统中，在system bus发送接收处理器间中断IPI。

![figure8-4.png](/images/operating-system/6.828/lab4/figure8-4.png)

处理器访问它自己的LAPIC通过MMIO(memory-mapped I/O)，在MMIO中，一部分物理内存直接与IO设备的寄存器相连接，所以类似于ld/store的指令通常被用作间接访问外围设备的寄存器。Lab2为IO hole在物理地址0xA0000留了一部分内存空间用作VAG显示缓冲。LAPIC位于内存地址`0xFE000000`(4GB - 32MB)处，这个地址很高，所以不能直接通过KERNBASE映射。JOS的虚拟内存为MMIOBASE保留了4MB的空间，所以可以用来映射设备的内存。
另外Lapic所使用的内存应该是被设计为strong uncacheable的，而在` kern/lapic.c`预先定义的ID，Version等信息可以在IA-32 Table8.1中查到。

![strong uncacheable](/images/operating-system/6.828/lab4/uncacheable.png)

接下来的实验中将会介绍更多MMIO的区域，并且为外围设备实现一些基础的内存分配和映射。

## 练习1

>实现`kern/pmap.c`中的`mmio_map_region()`
>研究`kern/lapic.c`中的`lapic_init()`

---

``` C
void *
mmio_map_region(physaddr_t pa, size_t size)
{
    static uintptr_t base = MMIOBASE;

    if (base + size > MMIOLIM)
        panic("mmio memory space is not enough .");

    uint32_t va = base;
    pa = ROUNDDOWN((uint32_t)pa, PGSIZE);
    size = ROUNDUP((uint32_t)size, PGSIZE);

    boot_map_region(kern_pgdir, base, size, pa, PTE_PCD|PTE_PWT|PTE_W);

    base += size;

    return (void *)va;
    //panic("mmio_map_region not implemented");
}
```

可以发现这个函数的页权限的设计是使用了PTE_PCD|PTE_PWT，当CPU采用高速缓存时，它的写内存操作有两种模式，一种称为“穿透”(Write-Through)模式，在这种模式中高速缓存对于写操作就好像不存在一样，每次写时都直接写到内存中，所以实际上只是对读操作使用高速缓存，因而效率相对较低。另一种称为“回写”(Write-Back)模式，写的时候先写入高速缓存，然后由高速缓存的硬件在周转使用缓冲线时自动写入内存，或者由软件主动地“冲刷”有关的缓冲线。另外一点就是Cache Disable，防止这里的内存被CPU缓存，就是为了保证LAPIC被映射在内存上的寄存器值能够准确地被读取。




注意`lapic_init()`开头几步，需要返回一个`MMIO`的地址


# Application Processor Bootstrap
在启动APs之前，BSP首先需要收集关于多处理器系统的信息，比如CPU的数量，它们的APIC ID以及这些LAPIC单元对应的MMIO地址。`kern/mpconfig.c`中`mp_init()`通过读取BIOS内存块的MP configuration table获取这些信息。

`kern/init.c`中的`boot_aps()`函数驱动AP的启动引导进程，APs在实模式下开始工作，就像之前的内核引导程序(`boot/boot.S`,)，`boot_aps`在实模式下复制一份AP entry code(`kern/mpentry.S`)到一个内存可以寻址的地方，所以一定程度上可以控制AP开始执行的内存地址；现在将把entry code复制到`0x7000(MPENTRY_PADDR)`，但实际上低于640KB未使用的页对齐的物理地址都可用。

之后，`boot_aps()`一个一个激活应用处理器，通过发送`STARTUP`中断信号到这些处理器对应的LAPIC单元，并且初始化CS:IP(指向MPENTRY_PADDR)。安装完后，使得AP开启保护模式，分页机制，并调用启动例程`mp_main()`。`boot_aps()`等待AP发送一个`Cpuinfo`结构体中的`CPU_STARTED`flag，然后再启动接下来的处理器。

---
## 练习2
> 将MPENTRY_PADDR从free_list中删除

boot_aps():将MPENTRY的代码安装到内核中去，为每一个cpu准备相应的栈区。然后通过一个for循环初始化所以cpu，在循环体内用while循环等待cpu被启动好的信号。
lapic_startup(id, addr)然后发送IPI到APIC bus上，让相应AP的LAPIC收到这个中断，开始执行mpentry.S中的内容，开启保护模式，分页；加载数据段，代码段等。

当mpentry执行到最后，调用mp_init()函数，初始化该AP的寄存器。
lapic_init():从处理器中获取lapic的相关信息
env_init_percpu():初始化每个处理器的段寄存器
trap_init_percpu():读取TSS和IDT
在最后，xchg()即发送`CPU_STARTED`信号给boot_aps()，完成一个cpu寄存器的初始化。
![figure8-5.png]( /images/operating-system/6.828/lab4/figure8-5.png)

前面说过，部分设备的寄存器与内存是直接映射的，这里也是，lapic与内存直接相连，所以在lapic_startup函数中可以看到，向cpu发送命令都是通过在特定内存区域读写。

``` C
void
page_init(void)
{
    size_t i;
    size_t allocated_pages = ((uint32_t)boot_alloc(0) - KERNBASE) / PGSIZE;
    size_t IOhole_pages = (EXTPHYSMEM - IOPHYSMEM) /PGSIZE;
    for (i = 1; i < npages; i++) {
        if(i == MPENTRY_PADDR/PGSIZE)
            continue;                  // BIOS
        else if (i >= npages_basemem && i < npages_basemem + allocated_pages + IOhole_pages){
            continue;                  // see figure
        } else {
            pages[i].pp_ref = 0;
            pages[i].pp_link = page_free_list;             // a linkedlist for
            page_free_list = &pages[i];                    // that the pages is free .
        }
    }

}
```
练习就是把MPENTRY_PADDR从`free_list`中去除即可。

>Compare kern/mpentry.S side by side with boot/boot.S. Bearing in mind that kern/mpentry.S is compiled and linked to run above KERNBASE just like everything else in the kernel, what is the purpose of macro MPBOOTPHYS? Why is it necessary in kern/mpentry.S but not in boot/boot.S? In other words, what could go wrong if it were omitted in kern/mpentry.S?

`MPBOOTPHYS`是用来计算传递进去参数的绝对地址，这段代码在boot_aps内就被复制到了内存高地址，AP读取gdt的命令`ldgdt`是在开启保护模式之前，所以，需要使用物理地址来读取全局表，否则不能读取到。但是在boot.S中，代码就是工作在实模式下，可以直接读取。

---
# Per-cpu State and Initialization
(manual 8.4.4)
在实现多处理系统的时候， 弄清每一个CPU所私有的部分和整个系统的共享是很重要的。`kern/cpu.h`中定义了cpu状态的结构体`struct CpuInfo`。`cpunnum`返回当前正在使用的ID，可以用作cpus数组的下标，当然也可以用宏`thiscpu`表示当前CPU结构体。

需要关注的CPU状态：
- 内核栈
    + 由于CPU能同时陷入内核，所以需要分离每一个CPU所对应的内核栈，阻止处理器对其他处理器在执行任务时相互影响，数组`percpu_kstacks[NCPU][KSTKSIZE]`存储了多个处理器所对应的内核栈地址。
    + Lab2中，已经将bootstack映射到KSTACKTOP，在这个实验中，需要映射每一个CPU的内核栈到这个区域，并且使用一个`guard pages`作为缓冲。CPU0使用KSTACKTOP，CPU1将使用KSTACKTOP - KSTKGAP，等等。`inc/memlayout.h`中有内存排布情况。

- TSS和TSS descriptor
    每个CPU的任务状态段TSS(task state segement)也需要被确认，CPU的TSS存储在`cpus[i].cpu_ts`中，TSS descriptor存储在GDT entry `gdt[(GD_TSS0 >> 3) + i]`中。

- 当前环境指针
  因为每个CPU都同时运行着不同的用户进程，所以使用重新定义的curenv。使用thiscpu->cpuenv来指向当前正在执行的环境。

- 系统寄存器
  所有的寄存器，都是每一个CPU私有的，所都需要通过指令初始化，`lcr3()`,`ltr()`,`lgdt()`,`lidt`等都需要在每个CPU上执行一次。函数`env_init_percpu`和`trap_init_percpu`用来完成这项工作。

---
## 练习3
> 完成内核栈的内存映射

---
``` C
static void
mem_init_mp(void)
{
    size_t i;
    uint32_t kstacktop_i = KSTACKTOP;

    for (i = 0; i < NCPU; i++) {
        /*stack*/
        boot_map_region(kern_pgdir, kstacktop_i - KSTKSIZE, KSTKSIZE, PADDR(percpu_kstacks[i]), PTE_W | PTE_P);
        kstacktop_i -= KSTKSIZE;

        /*guard gap*/
        kstacktop_i -= KSTKGAP;
    }
}
```
---
## 练习4
> 修改trap_init_percpu()，使得每个CPU都能使用。

---


```
    thiscpu->cpu_ts.ts_esp0 = (uint32_t)percpu_kstacks[thiscpu->cpu_id];
    thiscpu->cpu_ts.ts_ss0 = GD_KD;
    thiscpu->cpu_ts.ts_iomb = sizeof(struct Taskstate);

    // Initialize the TSS slot of the gdt.
    gdt[(GD_TSS0 >> 3) + thiscpu->cpu_id] = SEG16(STS_T32A, (uint32_t) (&(thiscpu->cpu_ts)),
                    sizeof(struct Taskstate) - 1, 0);
    gdt[(GD_TSS0 >> 3) + thiscpu->cpu_id].sd_s = 0;

    // Load the TSS selector (like other segment selectors, the
    // bottom three bits are special; we leave them 0)
    ltr(GD_TSS0 + (thiscpu->cpu_id << 3));

    // Load the IDT
    lidt(&idt_pd);

```

根据之前ts全局变量的过程，为每一个CPU都初始化任务状态。
__位移运算3位是因为每个描述符的大小是8字节(struct Segdesc)__

完成这里后，利用`make qemu-nox CPUS=4`可以发现其他cpu的成功启动

``` bash
$ make qemu-nox CPUS=4
***
*** Use Ctrl-a x to exit qemu
***
qemu-system-i386 -nographic -drive file=obj/kern/kernel.img,index=0,media=disk,format=raw -serial mon:stdio -gdb tcp::26000 -D qemu.log -smp 4
6828 decimal is 15254 octal!
Physical memory: 131072K available, base = 640K, extended = 130432K
check_page_free_list() succeeded!
check_page_alloc() succeeded!
check_page() succeeded!
check_kern_pgdir() succeeded!
check_page_free_list() succeeded!
check_page_installed_pgdir() succeeded!
SMP: CPU 0 found 4 CPU(s)
enabled interrupts: 1 2
SMP: CPU 1 starting
SMP: CPU 2 starting
SMP: CPU 3 starting
[00000000] new env 00001000
kernel panic on CPU 0 at kern/trap.c:295: kernel page fault
Welcome to the JOS kernel monitor!
Type 'help' for a list of commands.
K>
```


# 自旋锁
现在代码在执行mp_main()最后的for死循环，在AP继续运行之前，首先要解决多个CPU同时执行内核代码的条件竞争的问题。最简单的方法是使用big kernel lock，一种当一个环境进入了内核态开启的全局锁，当退回到用户态的时候解锁。在这个模式下，用户态都能同时正确地使用可用的CPU，但是只能有一个环境能运行在用户态，其他尝试进入内核态的环境都会被强制等待。

自旋锁(spinlock)是互斥(mutual exclusive)锁的一种实现形式，通过不断访问所需资源来判断临界资源资源是否被释放，优点是非常高效，临界资源一释放，等待的CPU将马上获得这份临界资源，所以适合那些保持锁时间短的情况，缺点是会持续占用CPU，浪费CPU时间。面对那些长时间占用临界资源的，应该使用信号量(semaphore)机制。

前段时间专业课上提到了`Swap`，就算一个基本的自旋锁。
代码实现如下:
``` C
void
Swap(boolean &a, boolean &b)
{
    boolean temp = a;
    a = b;
    b = temp;
}

# entry
do {
    Key = true;
    while (Key == ture)
        Swap(Lock, Key);
    critical Section;
    Lock = false;
    non critical Section
} while(1)

```


JOS自旋锁的实现是在`kern/spinlock`的spin_lock()中:
``` C
    while (xchg(&lk->locked, 1) != 0)
        asm volatile ("pause");
```

在`xchg()`中，这段代码的意思就是将数值“1”和`lk->locked`的值交换。

```
    asm volatile("lock; xchgl %0, %1"
             : "+m" (*addr), "=a" (result)
             : "1" (newval)
             : "cc");
    return result;
```

`lock` : 将下个访问内存指令所引用的内存空间上锁

    xchgl %0, %1: "+m" (*addr), "=a" (result): "1" (newval)

\*addr替代占位符%0，限定符"+m"代表可read-modify-write的内存变量，限定符"1"代表其后面的操作数去描述占位符%1。所以这句指令是将 *addr的值与 1进行交换，并且把结果输出到 \*addr和result中。

`cc` ：GNU文档解释，“As the condition codes will be changed, we are adding "cc" to clobberlist.”

在while循环体内，`pause`指令只是减少处理器执行太快引起的电力损耗，类似与一个延时语句。

---
## 练习5
>给合适的地方上锁
---


``` C
# i386_init()
    // Acquire the big kernel lock before waking up APs
    // Your code here:
    lock_kernel();
    // Starting non-boot CPUs
    boot_aps();

# mp_main()
    // Now that we have finished some basic setup, call sched_yield()
    // to start running processes on this CPU.  But make sure that
    // only one CPU can enter the scheduler at a time!
    //
    // Your code here:
    lock_kernel();

    sched_yield();
# trap()
   if ((tf->tf_cs & 3) == 3) {
        // Trapped from user mode.
        // Acquire the big kernel lock before doing any
        // serious kernel work.
        // LAB 4: Your code here.
        assert(curenv);
        lock_kernel();
        ...
    }
# env_run()
    //switch to user's address space.
    lcr3(PADDR(curenv->env_pgdir));

    //following operation will not implement the kernel
    //data, releasing the kernel resources here.
    unlock_kernel();

    // pop trap frame , the environment return to the user mode.
    env_pop_tf(&(curenv->env_tf));
```

完成这部分上锁的时候，可以看见在启动AP之前，内核是被BSP给锁定的，其他的CPU都还卡在自旋锁处进行循环。

>Q2:It seems that using the big kernel lock guarantees that only one CPU can run the kernel code at a time. Why do we still need separate kernel stacks for each CPU? Describe a scenario in which using a shared kernel stack will go wrong, even with the protection of the big kernel lock.

当一个CPU陷入内核还在进行保存状态信息的时候，另一个CPU刚好发生中断，此时内核还未被上锁，在只有一个栈的情况下，会发生混乱。

## Challenge

// fine-grained locking

---
##  练习6
>实现Round-Robin Scheduling调度算法
---

这个调度算法就是在envs全局变量中找到第一个可以运行的程序，观察`user/yield.c`的程序，代码每一次循环产生一次系统调用，让CPU执行下一个env。
实现这个调度算法就是利用循环队列来做。

``` C
void
sched_yield(void)
{
    // LAB 4: Your code here.
    int i, cur_id, nxt;

    if (curenv)
        cur_id = ENVX(curenv->env_id);
    else
        cur_id = 0;
#ifdef SELF_DEBUG_INFO
    cprintf("cpuid %d \n", thiscpu->cpu_id);
#endif
    for (i = 0; i < NENV; i++) {
        nxt = (i + cur_id) % NENV;
        if (envs[nxt].env_status == ENV_RUNNABLE)
            env_run(envs + nxt);
    }

    // there are no others environment to run.
    if (curenv && curenv->env_status == ENV_RUNNING)
        env_run(curenv);
        // sched_halt never returns
        sched_halt();
}

```

添加新的系统调用和创建多个这样的用户环境
``` C
# syscall_dispatch()
    case SYS_yield:
        sys_yield();
        return 0;
# i386_init()
#if defined(TEST)
    // Don't touch -- used by grading script!
    ENV_CREATE(TEST, ENV_TYPE_USER);
#else
    // Touch all you want.
    ENV_CREATE(user_yield, ENV_TYPE_USER);
    ENV_CREATE(user_yield, ENV_TYPE_USER);
    ENV_CREATE(user_yield, ENV_TYPE_USER);
    ENV_CREATE(user_yield, ENV_TYPE_USER);
    ENV_CREATE(user_yield, ENV_TYPE_USER);
#endif // TEST*
```

>Q3:In your implementation of env_run() you should have called lcr3(). Before and after the call to lcr3(), your code makes references (at least it should) to the variable e, the argument to env_run. Upon loading the %cr3 register, the addressing context used by the MMU is instantly changed. But a virtual address (namely e) has meaning relative to a given address context--the address context specifies the physical address to which the virtual address maps. Why can the pointer e be dereferenced both before and after the addressing switch?

`e`在创建的时候会从`kern_pgdir`处复制一份，所以`lcr3`指令执行前后页表项是一样的。

>Q4:Whenever the kernel switches from one environment to another, it must ensure the old environment's registers are saved so they can be restored properly later. Why? Where does this happen?

`env_run()`通过pop`task frame`，而在调用trap()的时候就已经保存了相关寄存器信息。


## Challenge

// stride scheduling 和 lottery scheduling


# System Calls for Environment Creation
虽然代码能在不同的用户环境中切换了，但是是依靠的内核初始化创建的环境。现在要做的就是实现在用户环境下创建和开始另一个新的用户环境。

Unix中提供了最原始的fork()函数进行创建ixnd进程，`fork`复制整个父进程的内存空间去新建一个进程，唯一不同的就是它们的返回值，子进程返回0.

在这个练习中，将为JOS实现更为原始的方法去创建新用户空间。

---
## 练习7
>完成syscall.c
---

### sys_exofork
``` C
static envid_t
sys_exofork(void)
{
    // LAB 4: Your code here.
    int r;
    struct Env *new_env;

    if ((r = env_alloc(&new_env, sys_getenvid())) < 0)
        return r;

    new_env->env_tf = curenv->env_tf;
    new_env->env_status = ENV_NOT_RUNNABLE;
    // child env return 0
    new_env->env_tf.tf_regs.reg_eax = 0;

    return new_env->env_id;
```

### sys_env_set_status
``` C
static int
sys_env_set_status(envid_t envid, int status)
{
    // LAB 4: Your code here.
    //panic("sys_env_set_status not implemented");

    struct Env *e;
    int ret;

    /* must be ENV_RUNNABLE or ENV_NOT_RUNNABLE*/
    if (status == ENV_RUNNABLE ||
        status == ENV_NOT_RUNNABLE)
        ;
    else
        return -E_INVAL;

    /* check whether the caller env is env to be set*/
    if ((ret = envid2env(envid, &e, 1)) < 0)
        return ret;

    e->env_status = status;

    return 0;

}
```

### sys_page_alloc
``` C
static int
sys_page_alloc(envid_t envid, void *va, int perm)
{
    // LAB 4: Your code here.
    //panic("sys_page_alloc not implemented");
    int ret;
    struct PageInfo *pg;
    struct Env *e;

    /*
    *   regist the page in the page directory
    */

    /*check envid*/
    if (envid2env(envid, &e, 1) < 0)
        return -E_BAD_ENV;

    /*check va*/
    if ((uint32_t)va >= UTOP || (uint32_t)va % PGSIZE)
        return -E_INVAL;

    /* permission check */
    if (perm & ~(PTE_U | PTE_P | PTE_AVAIL | PTE_W))
        return -E_INVAL;

    /*allocating page and mapping*/
    pg = page_alloc(ALLOC_ZERO);
    if (!pg)
        return -E_NO_MEM;

    if ((ret = page_insert(e->env_pgdir, pg, va, perm ))) {
        page_free(pg);  // failed, free page;
        return ret;
    }
    return 0;
}

```

### sys_page_map
``` C
static int
sys_page_map(envid_t srcenvid, void *srcva,
         envid_t dstenvid, void *dstva, int perm)
{
    // LAB 4: Your code here.
    //panic("sys_page_map not implemented");

    /*
    *   mapping
    */

    pte_t *pte; // page table entry;
    struct Env *src, *dst;
    struct PageInfo *pp;

    /*check env*/
    if (envid2env(srcenvid, &src, 1) < 0 ||
        envid2env(dstenvid, &dst, 1) < 0)
        return -E_BAD_ENV;

    /* check va */
    if ((uint32_t)srcva >= UTOP || (uint32_t)srcva % PGSIZE ||
        (uint32_t)dstva >= UTOP || (uint32_t)dstva % PGSIZE)
        return -E_INVAL;

    /* check address space*/
    if ((pp = page_lookup(src->env_pgdir, srcva, &pte)) == NULL)
        return -E_INVAL;

    /* check parameter permission */
    if (perm & ~(PTE_P | PTE_U | PTE_AVAIL | PTE_W))
        return -E_INVAL;

    /* pte permission check*/
    if (!(*pte & PTE_W) && (perm & PTE_W))
        return -E_INVAL;

    return page_insert(dst->env_pgdir, pp, dstva, perm );

}
```

### sys_page_unmap
``` C
static int
sys_page_unmap(envid_t envid, void *va)
{
    struct Env *e;
    /*check env*/
    if (envid2env(envid, &e, 1))
        return -E_BAD_ENV;

    if ((uint32_t)va >= UTOP || (uint32_t)va % PGSIZE)
        return -E_INVAL;

    page_remove(e->env_pgdir, va);

    return 0;
    // LAB 4: Your code here.
    //panic("sys_page_unmap not implemented");
}
```
``` C
int32_t
syscall(uint32_t syscallno, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5)
{
#define SELF_DEBUG_INFO
#ifdef SELF_DEBUG_INFO
    cprintf("call number:%d  \n", syscallno);
#endif
    switch (syscallno) {

    case SYS_cputs:
        sys_cputs((char *)a1, a2);
        return 0;

    case SYS_cgetc:
        return sys_cgetc();

    case SYS_getenvid:
        return sys_getenvid();

    case SYS_env_destroy:
        return sys_env_destroy(a1);

    case SYS_yield:
        sys_yield();
        return 0;

    case SYS_exofork:
        return sys_exofork();

    case SYS_page_alloc:
        return sys_page_alloc(a1, (void *)a2, a3);

    case SYS_page_map:
        return sys_page_map(a1, (void *)a2, a3, (void *)a4, a5);

    case SYS_page_unmap:
        return sys_page_unmap(a1, (void *)a2);

    case SYS_env_set_status:
        return sys_env_set_status(a1 ,a2);

    default:
        return -E_INVAL;
    }
}

```

两点问题:
1. 注意在设置status的时候的逻辑短路问题。
2. exofork()中新的用户环境的eax应该置为0，以证明是子进程。

用户环境的代码执行完后，一个CPU会执行kernel monitor一直占用内核，而另外3个CPU都在卡在了trap中的那个自旋锁中。

PART A done.

---

# Part B: Copy-On-Write Fork
最初Unix提供最基础的fork()系统调用去创建新的进程，forK()通过复制整个父进程的内存空间到子进程的内存中去，然而复制父进程到子进程是fork()操作开销最大的一个操作。通常情况下，fork()后子进程一般会马上调用exec()函数，用新的程序去替代子进程的内存空间。在这种情况下，复制父进程内存空间的时间开销很大程度上是不需要的，因为子进程仅有非常小的一部分被exec()所使用。

在之后的版本中，Unix采用虚拟内存硬件这一机制，允许父子进程共享分别被映射到它们各自内存空间的内存，直到其中一个进程确实修改了这部分共享的内存，被称之为__copy on write__。为了这个机制，fork()不是复制被实际映射的页，而是复制描述内存空间的映射情况的页，同时标记这个页为只读。一旦这两个进程之一尝试去修改这部分被共享的页，该进程将会产生页错误。此时，Unix内核意识到这个页是一个"copy-on-write"的页需要被拷贝，于是分配一个新的私有的可写的页拷贝给这个产生页错误的进程。通过这种方式，这些分开的页的内容实际不会复制除非这些页确实别尝试写入。这个优化使得fork()后在子进程中执行exec()的开销更小，子进程可能只需要复制一个页(stack page)在调用exec()前。

# User-level page fault handling
首先实现写时拷贝的fork()，需要知道被写保护的页。copy-on-write是多种可能处理页错误的方法之一。

一种通用做法就是建立起一个内存空间指出当发生页错误的时候确定一些操作。比如，大多数Unix内核只为新进程的栈区映射一个单页面，分配和映射额外的栈页仅在该新进程栈增长和在栈地址中发生了未映射的栈区域时处理。通常unix内核需要确定对应处理方法当页错误发生在进程的不同区域。页错误发生在栈区通常分配和映射一个新的页帧给这个进程；页错误发生在程序的BSS区域通常分配一个新的页，并且将页内容全部置为0，并且映射到页表中去；页错误发生在可执行文件的.text区域将会从磁盘中读取相应的二进制文件，并且映射。

这种处理办法虽然需要内核追踪一大堆信息，但是大大增加了程序的灵活性。

# Normal and Exception Stacks in User Environments
正常执行过程中，用户环境将会运行在正常用户栈中：即ESP寄存器最开始就指向了USTACKTOP，栈区数据被压入到`USTACKTOP-PGSIZE`和`USTACKTOP-1`这个范围中。当页错误发生在用户态下，内核将会重启这个用户环境，并且运行在一个被设计好的用户级别页错误解决办法(page fault handler)在一个不同的栈上，被称之为用户异常栈。大体上来说，JOS实现了在用户模式下的栈自动切换，同时，x86处理器已经实现了栈切换当发生从用户态到内核态发生转换的时候。

JOS的异常栈也是只有PGSIZE，但是定义在了虚拟内存地址的UXSTACKTOP，所以在栈区`UXSTACKTOP`到`UXSTACKTOP-1`都是合法的。当运行在异常栈，用户级页错误handler能用普通的系统调用去映射新的页，调节映射情况并且修复这个导致页错误的问题。然后，这个handler将会return，通过汇编语言stub返回到发生页错误的代码处。

任何一个用户程序需要支持用户级页错误将会需要去分配页给异常栈。

# Invoking the User Page Fault Handler

为了解决来自用户态的页错误，现在需要调用用户态在发送页错误时的trap-time状态。
如果没有页错误的handler被登记，JOS内核将会销毁这个用户进程，不然的话，内核将要设置下面这样的trap frame在该用户环境的异常栈上。

``` C
                    <-- UXSTACKTOP
trap-time esp
trap-time eflags
trap-time eip
trap-time eax       start of struct PushRegs
trap-time ecx
trap-time edx
trap-time ebx
trap-time esp
trap-time ebp
trap-time esi
trap-time edi       end of struct PushRegs
tf_err (error code)
fault_va            <-- %esp when handler is run
(_pgfault_handler argument)
(eip pushed by call instruction)
reserved 4-bytes    <-- to ret, reserved for eip
trap-time esp       <-- we should adjust the esp(esp = esp-4)
trap-time eflags
trap-time eip
...                new trap-time frame
trap-time esi
trap-time edi
tf_err (error code)
fault_va            <-- esp

```

系统内核需要准备用户在异常栈上面执行page fault handler的准备，`fault_va`是导致页错误的虚拟地址。

如果用户环境在执行异常处理的时候发生页错误，那么将要将trap-time frame压栈在tf->tf_esp之下，而不是UXSTACKTOP。在这里，需要压入1个空的32-bit字，然后压入trap-time帧。

为了确定tf->tf_esp是否已经在用户异常栈了，只需要检查它是否在范围`UXSTACKTOP-PGSIZE`和`UXSTACKTOP-1`这个范围内即可。

---
## 练习9
>实现`page_fault_handler`中的代码
---
程序的执行流梳理下：
1. 首先用户程序使用`sys_set_env_pgfault_handler()`系统调用设置好页错误处理方法。
2. 当用户程序发生页错误的时候，此时trap进入内核，通过`trapdispatch()`的分发错误机制，单独处理页错误。
3. 因为是在用户环境下发生的页错误，内核将该用户环境的运行栈改成异常栈，

``` C
void
page_fault_handler(struct Trapframe *tf)
{
    ...
    // LAB 4: Your code here.
    struct UTrapframe *utf;
    uint32_t uesp;

    cprintf("user page fault\n");

    if (tf->tf_esp <= UXSTACKTOP-1 && tf->tf_esp >= UXSTACKTOP-PGSIZE)
        uesp = tf->tf_esp - sizeof(struct UTrapframe) - 4;
    else
        uesp = UXSTACKTOP - sizeof(struct UTrapframe);

    /* call upcall if current env has handler*/
    if (curenv->env_pgfault_upcall != NULL) {

        user_mem_assert(curenv, (void *)uesp, sizeof(struct UTrapframe), PTE_U|PTE_P|PTE_W);

        /*locates to the exception stack*/
        utf = (struct UTrapframe *)uesp;

        /*construct User trap frame*/
        utf->utf_fault_va = fault_va;
        utf->utf_err = tf->tf_err;
        utf->utf_regs = tf->tf_regs;
        utf->utf_eflags = tf->tf_eflags;
        utf->utf_eip = tf->tf_eip;
        utf->utf_esp = tf->tf_esp;

        /*ready for handler paremeter*/
        tf->tf_esp = uesp;

        /*after trap , execute the handler routine*/
        tf->tf_eip = (uint32_t)curenv->env_pgfault_upcall;

        env_run(curenv);
    }
    ...
}
```

## 练习10
>当发生页错误的时候，内核通过设置eip指向\_pgfault\_upcall来调用汇编代码，并且调用已经注册好的handler，该练习的任务就是当handler执行完后，用户如何返回到错误时的状态去。
---

``` asm
.globl _pgfault_upcall
_pgfault_upcall:
    // Call the C page fault handler.
    pushl %esp          // function argument: pointer to UTF
    movl _pgfault_handler, %eax
    call *%eax
    addl $4, %esp

    // LAB 4: Your code here.
    subl $0x4, 0x30(%esp) # for push eip
    movl 0x30(%esp), %ebx #regular esp
    movl 0x28(%esp), %eax #eip
    movl %eax, (%ebx)

    // Restore the trap-time registers.  After you do this, you
    // can no longer modify any general-purpose registers.
    // LAB 4: Your code here.
    addl $0x8, %esp
    popal #regular registers

    // Restore eflags from the stack.  After you do this, you can
    // no longer use arithmetic operations or anything else that
    // modifies eflags.
    // LAB 4: Your code here.
    addl $0x4, %esp
    popfl

    // Switch back to the adjusted trap-time stack.
    // LAB 4: Your code here.
    popl %esp
    // Return to re-execute the instruction that faulted.
    // LAB 4: Your code here.
    ret
```


## 练习11
>完成set_pgfault_handler()
---
``` C

void
set_pgfault_handler(void (*handler)(struct UTrapframe *utf))
{
    int r;

    if (_pgfault_handler == 0) {
        // First time through!
        // LAB 4: Your code here.
        //panic("set_pgfault_handler not implemented");
        if (sys_page_alloc(0, (void *)UXSTACKTOP-PGSIZE, PTE_W|PTE_U|PTE_P) < 0)
            panic("memory allocation failed: On UXSTACKTOP");
    }

    // Save handler pointer for assembly to call.
    _pgfault_handler = handler;
    if (sys_env_set_pgfault_upcall(0, _pgfault_upcall) < 0)
        panic("bad env");
}
```

通过一个callback function登记需要运行的handler，实现对不同情况的异常分发。

#Implementing Copy-on-Write Fork
与之前练习中的`dumbfork()`不同的是，`dumbfork()`复制了整个父环境中的所有的页，但是fork()仅仅只会复制一个关于页映射的页，其他的页会在用户环境往这些被标记的页写入内容的时候，发生页错误，并且分配新页，复制页内容。

fork()的控制流如下：
1. 父环境安装`pgfault()`作为page fault handler，利用set_pgfault_handler()可以做到。
2. 父环境调用`sys_exofork()`来创建子环境。
3. 将每一个地址低于`UTOP`的状态为`可写`或者`copy-on-write`的页，使用`duppage`函数，映射到子环境的内存空间去，并且把*自己*的和子内存空间的页状态都标记`COW`状态。

- 异常栈不需要被映射，取而代之的是，父环境需要为子环境异常栈分配一个新的页。

4. 为子环境设置页错误入口
5. 将子环境标记为可运行状态。

每当父环境或者子环境尝试写入状态为cow的页时，将会引发页错误，页错误处理程序的控制流如下：
1. 内核传递也错给\_pgfault\_，然后调用pgfault()来处理
2. `pgfault()`检查页错误的错误代码(FEC_WR)，并且页是否被标记为PTE_COW，如果不是，panic。
3. `pgfault()`分配一个新的页映射到一个临时位置，然后复制发生错误的页到临时页位置，然后再将这个临时位置映射到一个合适的位置，并且标记为可读可写，代替之前只读的映射。

## 练习12
>实现fork,duppage,pgfault
---

### fork()
``` C
envid_t
fork(void)
{
    // LAB 4: Your code here.
    //panic("fork not implemented");
    set_pgfault_handler(pgfault);

    int r;
    envid_t envid;
    int32_t va;

    envid = sys_exofork();
    if (envid < 0)
        panic("sys_exofork error");
    if (envid == 0) {
    //  panic("child");
        thisenv = &envs[ENVX(sys_getenvid())];
        cprintf("child: %d\n", thisenv->env_id);
        return 0;
    }

    cprintf("parent fork:%d -> %d\n", thisenv->env_id, envid);
    for (va = 0; va < USTACKTOP; va += PGSIZE)
        if ((uvpd[PDX(va)] & PTE_P) && (uvpt[PGNUM(va)] & (PTE_P|PTE_U)) )
                duppage(envid, (uint32_t)PGNUM(va));
    //panic("1");
    if ((r = sys_page_alloc(envid, (void *)UXSTACKTOP-PGSIZE, PTE_P|PTE_U|PTE_W)) < 0)
        return r;

    extern void _pgfault_upcall(void);
    sys_env_set_pgfault_upcall(envid, _pgfault_upcall);

    if ((r = sys_env_set_status(envid, ENV_RUNNABLE)) < 0)
        return r;

    return envid;
}
```

### duppage()
``` C
static int
duppage(envid_t envid, unsigned pn)
{
    int r;
    uint32_t va;
    // LAB 4: Your code here.
    //panic("duppage not implemented");
    va = pn*PGSIZE;
    //cprintf("%x\n", va);
    if (uvpt[pn] & PTE_COW || uvpt[pn] & PTE_W) {
        if ((r = sys_page_map(thisenv->env_id, (void *)va, envid, (void *)va, PTE_P|PTE_U|PTE_COW)) < 0)
            panic("2");
        if ((r = sys_page_map(thisenv->env_id, (void *)va, thisenv->env_id, (void *)va, PTE_P|PTE_U|PTE_COW)) < 0)
            panic("3");
    } else
        if ((r = sys_page_map(thisenv->env_id, (void *)va, envid, (void *)va, PTE_U|PTE_P)) < 0)
            panic("4");
    return 0;
}
```


### pgfault()
``` C
static void
pgfault(struct UTrapframe *utf)
{
    void *addr = (void *) utf->utf_fault_va;
    uint32_t err = utf->utf_err;
    int r;

    //cprintf("%d\n", err);
    if (!(err & FEC_WR) || !(uvpt[PGNUM(addr)] & PTE_COW))
        panic("user page fault: write to non-copy-on-write page");


    // LAB 4: Your code here.
    //panic("pgfault not implemented");
    addr = (void *)ROUNDDOWN((uint32_t)addr, PGSIZE);
    //cprintf("thisenv->envid : %d\n", thisenv->env_id);
    if ((r = sys_page_alloc(0, (void *)PFTEMP, PTE_P|PTE_U|PTE_W)) < 0)
        panic("handler fault :haven't memory ");
    memmove((void *)PFTEMP, addr, PGSIZE);
    if ((r = sys_page_map(0, (void *)PFTEMP, 0, addr, PTE_P|PTE_U|PTE_W)) < 0)
        panic("handler fault: sys_page_map");

    if ((r = sys_page_unmap(0, PFTEMP)) < 0)
        panic("handler fault: sys_page_unmap");

}

```

两个问题：
1.在这，fork()是设置好子环境的相关上下文才调度到子环境中去的。

2. `thisenv->env`在`duppage()`中使用正常，但是在`pgfault()`会panic，于是观察系统调用信息：这个fork二叉树的根节点会在设置完子进程的信息后销毁，然后cpu调度新的任务。fork()函数中Hint告诉我注意修改子进程中的`thienv`的值。

    thisenv = &envs\[ENVX(sys_getenvid())\];

`thisenv`是一个全局(静态)变量，被放在程序的.data域，父环境已经标记这个页为cow状态，所以这个赋值写操作会引发页错误。然后页错误处理程序来为这个页做一个拷贝到该子环境内存空间中。所以当我使用三个系统调用`sys_page_alloc`,`sys_page_map`,`sys_page_unmap`并且传递`thisenv->env_id`的时候，是被标记为cow的页发送读请求，结果读到的是父环境的内存内容。父环境已经被销毁了，所以程序在这儿被panic。
![debuginfo.png]( /images/operating-system/6.828/lab4/debuginfo.png)
PS:父环境销毁的时候并不会回收实际页帧，每个页帧都要一个引用计数器，引用计数器的值在fork()的情境下，应该为2，所以不会被会受到free_list中去

PART B done

---


# Part C: Preemptive Multitasking and Inter-Process communication (IPC)

# Clock Interrupts and Preemption
运行`user/spin`测试程序，这个程序fork出一个子进程，子进程一旦接手CPU后只是简单地永久循环。父进程和内核都不能再获得CPU，这对保护操作系统防范恶意代码和bug的影响当然不是个好情况，因为任何用户态的进程都能接管整个系统去执行一个死循环。为了允许内核去抢占一个正在执行的环境，强制地重新获取CPU，必须为JOS提供来自时钟硬件的外部硬件中断。

# Interrput discipline
外部中断又被称作IRQ(Interrupt Request Line)，有16种可能的IRQ，从0-15。`picirq.c`中的`pic_init()`映射IRQ 0-15映射到IDT的IRQ\_OFFSET~IRQ\_OFFSET+15。

`inc/trap.h`文件中，IRQ_OFFSET 被定义为十进制的23，用IDT表的32-47对应IRQ的0~15中断。例如，时钟中断是IRQ的0号，IDT\[IRQ_OFFSET+0\]包含了再内核中的时钟的历程。`IRQ_OFFSET`，选用`IRQ_OFFSET`这个值是为了不覆盖处理器异常。

JOS做了一个相对于`xv6`来说关键性的简化，外部中断_总是_在内核态的时候总是被关闭的。外部中断被`eflags`寄存器的IF位所控制。当这个bit位被置1时，外部中断被打开。当然这个flag值能被多种方法修改，但是由于JOS的简化，保存和恢复`eflags`寄存器只有一种单独的方式进入和离开用户态。

在外部中断来临之前，必须保证`FL_IF`的标志位被设置，中断号通过处理器获得。否则，中断会被屏蔽，或者会被忽略直到中断位被重新开启。在bootloader的时候，就已经屏蔽了中断，并且到现在都没有重新开启它们。

---
## 练习13
>修改`kern/trapentry.S`和`kern/trap.c`，在IDT中去初始化合适的入口，并且为IRQ提供合适的handler。
>然后修改env_alloc()保证用户环境总是开启了中断响应。
>去掉sti(set interrupt-enable flag)指令的注释，使得这个闲置CPU取消屏蔽中断。
>处理器对于硬件中断不会push错误代码(通过CPU针脚和lapic的都不会)
---

> >for example, it is possible to invoke the page-fault handler through the
INTR pin (by means of vector 14); however, this is not a true page-fault exception. It is an interrupt.

也就是说，之前的异常是通过中断产生的，在这个练习中，需要为每一个env都开启IF标志位，所以需要修改之前的handler，使得用户环境发生中断的时候，将IF清0，屏蔽中断。

### trap.c
``` C
    //irq
    void irq_handler0();
    void irq_handler1();
    void irq_handler2();
    void irq_handler3();
    void irq_handler4();
    void irq_handler5();
    void irq_handler6();
    void irq_handler7();
    void irq_handler8();
    void irq_handler9();
    void irq_handler10();
    void irq_handler11();
    void irq_handler12();
    void irq_handler13();
    void irq_handler14();
    void irq_handler15();
    SETGATE(idt[T_DIVIDE], 0, GD_KT, divid_entry, 0);
    SETGATE(idt[T_DEBUG], 0, GD_KT, debug_entry, 3);
    SETGATE(idt[T_NMI], 0, GD_KT, nmi_entry, 0);
    SETGATE(idt[T_BRKPT], 0, GD_KT, brkpt_entry, 3);
    SETGATE(idt[T_OFLOW], 0, GD_KT, oflow_entry, 0);
    SETGATE(idt[T_BOUND], 0, GD_KT, bound_entry, 0);
    SETGATE(idt[T_ILLOP], 0, GD_KT, illop_entry, 0);
    SETGATE(idt[T_DEVICE], 0, GD_KT, device_entry, 0);
    SETGATE(idt[T_DBLFLT], 0, GD_KT, dblflt_entry, 0);
    SETGATE(idt[T_TSS], 0, GD_KT, tss_entry, 0);
    SETGATE(idt[T_SEGNP], 0, GD_KT, segnp_entry, 0);
    SETGATE(idt[T_STACK], 0, GD_KT, stack_entry, 0);
    SETGATE(idt[T_GPFLT], 0, GD_KT, gpflt_entry, 0);
    SETGATE(idt[T_PGFLT], 0, GD_KT, pgflt_entry, 0);
    SETGATE(idt[T_FPERR], 0, GD_KT, fperr_entry, 0);
    SETGATE(idt[T_SYSCALL], 0, GD_KT, syscall_entry, 3);
    //irq handler mapping
    SETGATE(idt[IRQ_OFFSET+0], 0, GD_KT, irq_handler0, 3);
    SETGATE(idt[IRQ_OFFSET+1], 0, GD_KT, irq_handler1, 3);
    SETGATE(idt[IRQ_OFFSET+2], 0, GD_KT, irq_handler2, 3);
    SETGATE(idt[IRQ_OFFSET+3], 0, GD_KT, irq_handler3, 3);
    SETGATE(idt[IRQ_OFFSET+4], 0, GD_KT, irq_handler4, 3);
    SETGATE(idt[IRQ_OFFSET+5], 0, GD_KT, irq_handler5, 3);
    SETGATE(idt[IRQ_OFFSET+6], 0, GD_KT, irq_handler6, 3);
    SETGATE(idt[IRQ_OFFSET+7], 0, GD_KT, irq_handler7, 3);
    SETGATE(idt[IRQ_OFFSET+8], 0, GD_KT, irq_handler8, 3);
    SETGATE(idt[IRQ_OFFSET+9], 0, GD_KT, irq_handler9, 3);
    SETGATE(idt[IRQ_OFFSET+10], 0, GD_KT, irq_handler10, 3);
    SETGATE(idt[IRQ_OFFSET+11], 0, GD_KT, irq_handler11, 3);
    SETGATE(idt[IRQ_OFFSET+12], 0, GD_KT, irq_handler12, 3);
    SETGATE(idt[IRQ_OFFSET+13], 0, GD_KT, irq_handler13, 3);
    SETGATE(idt[IRQ_OFFSET+14], 0, GD_KT, irq_handler14, 3);
    SETGATE(idt[IRQ_OFFSET+15], 0, GD_KT, irq_handler15, 3);

```

### trapentry.S
```
TRAPHANDLER_NOEC(irq_handler0, 32);
TRAPHANDLER_NOEC(irq_handler1, 33);
TRAPHANDLER_NOEC(irq_handler2, 34);
TRAPHANDLER_NOEC(irq_handler3, 35);
TRAPHANDLER_NOEC(irq_handler4, 36);
TRAPHANDLER_NOEC(irq_handler5, 37);
TRAPHANDLER_NOEC(irq_handler6, 38);
TRAPHANDLER_NOEC(irq_handler7, 39);
TRAPHANDLER_NOEC(irq_handler8, 40);
TRAPHANDLER_NOEC(irq_handler9, 41);
TRAPHANDLER_NOEC(irq_handler10, 42);
TRAPHANDLER_NOEC(irq_handler11, 43);
TRAPHANDLER_NOEC(irq_handler12, 44);
TRAPHANDLER_NOEC(irq_handler13, 45);
TRAPHANDLER_NOEC(irq_handler14, 46);
TRAPHANDLER_NOEC(irq_handler15, 47);
```

### env.c
``` C
    // Enable interrupts while in user mode.
    // LAB 4: Your code here.
    e->env_tf.tf_eflags |= FL_IF;

```

此时为每一个用户进程响应外部中断。

---

# Handing Clock Interrupts
在`user/spin`程序中，在子程序一开始运行时就仅仅是一直循环，内核不能取回控制权，所以现在需要生成周期性的时钟中断，强制性地取回内核的控制权，并且切换到不同的用户环境。

## 练习14
>修改`trap_dispatch()`，使得当发生时钟中断的时候，调用不同的用户环境。
---

``` C
    // Handle clock interrupts. Don't forget to acknowledge the
    // interrupt using lapic_eoi() before calling the scheduler!
    // LAB 4: Your code here.
    if (tf->tf_trapno == IRQ_OFFSET + 0) {
        lapic_eoi();
        sched_yield();
    }
```

__eoi__(end of interrupt):置为0表示该中断例程已经结束了。

---

# Inter-Process communication (IPC)

之前都是关注的操作系统的独立性，这种方式使得每个程序看似独占一台机器。另外一个重要的操作系统服务就是允许程序与其他的程序进行交互。Unix中的pipe模型就是一个很典型的例子。

还有很多模型提供了IPC，关于这些模型哪个最好仍在争议中，取而代之的实现一个简单的IPC机制。

首先为JOS kernel提供几个的系统调用(`sys_ipc_recv`和`sys_ipc_try_send`)提供一个简单的IPC机制，然后实现两个库函数包装系统调用。

用户环境能发送给其他环境的“消息”由两部分组成：一个32-bit的值和一个可选的单页映射。相比单个32位整形，提供了一种更高效的通过传递页映射信息的方式，允许环境更方便设置共享内存。

# Sending and Receiving Messages
为了接收信息，一个用户环境调用`sys_ipc_recv`。系统调用放弃CPU当前执行的用户环境，并且直到接收到信息之前不会再运行。当一个用户环境正在等待一个消息，任何其他的环境能给它发送消息(不需要特定的用户环境，不需要父子进程等)。换句话说，PART A中的检查对IPC不适用，因为IPC系统调用被设计得很安全：一个用户进程不会因为被接收消息而发生失灵。

为了尝试发送一个值，用户环境调用`sys_ipc_try_send`发送接收者的环境id和需要发送的值。如果该id所指的环境确实在接收状态，那么发送方发送消息并且返回0。否则发送方返回`-E_IPC_NOT_RECV`指出目标环境现在不期望获得一个值。

用户空间的库函数`ipc_recv`将会调用`sys_ipc_recv`并且寻找相关被接收的值。同样地，`ipc_send`将会重复地调用`sys_ipc_try_send`直到成功。

# Transferring Pages
当一个用户环境调用`sys_ipc_recv`使用了一个合法的`dstva`参数，那么这个环境将会愿意去接受一个页的映射。如果发送方发送了一个页，那么这个页将会被映射到接收方的`dstva`这个地址空间去。 如果接收方已经映射了页帧在`dstva`，那么先前的页映射将会被取消。

当一个用户环境调用`sys_ipc_try_send`传递小于`UTOP`的参数`srcva`，这意味着发送方想将这个页映射到接收方的内存空间，并且设置权限位`perm`。成功IPC后，发送方保持之前的页映射，但是接收方映射了与发送方相同的页帧到`dstva`，这使得双方能共享同一个页。如果发送方或者接收方没有指出哪个页需要被发送，那么就没有页被发送。

## 练习15
>先实现`sys_ipc_recv`和`sys_ipc_try_send`,checkperm需要被置0，因为不一定需要父子关系才能引用。
>实现`ipc_recv`和`ipc_send`，这是对系统调用的一个封装。
>用user/pingpong和user/primes测试IPC机制。
---


### sys_ipc_recv()
``` C
static int
sys_ipc_recv(void *dstva)
{
    // LAB 4: Your code here.
    //panic("sys_ipc_recv not implemented");
    if ((uint32_t)dstva < UTOP && (uint32_t)dstva % PGSIZE)
        return -E_INVAL;

    //mapping

    //set status
    curenv->env_ipc_recving = true;
    curenv->env_ipc_dstva = dstva;
    curenv->env_status = ENV_NOT_RUNNABLE;
    sched_yield();
    return 0;
}
```
### sys_ipc_try_send()
``` C
static int
sys_ipc_try_send(envid_t envid, uint32_t value, void *srcva, unsigned perm)
{
    // LAB 4: Your code here.
    //panic("sys_ipc_try_send not implemented");
    struct Env *dstenv;
    struct PageInfo *pp;
    pte_t *pte;

    //cprintf("%x, val: %d\n", srcva, value);
    if (envid2env(envid, &dstenv, 0) < 0)
        return -E_BAD_ENV;
    if (!dstenv->env_ipc_recving)
        return -E_IPC_NOT_RECV;
    if (perm & ~PTE_SYSCALL)
        return -E_INVAL;

    // for page mapping checks //
    if ((uint32_t)srcva < UTOP) {
        if ((uint32_t)srcva % PGSIZE)
            return -E_INVAL;
        if (!(pp = page_lookup(curenv->env_pgdir, srcva, &pte)))
            return -E_INVAL;
        if (perm & PTE_W && !(*pte & PTE_W))
            return -E_INVAL;
        if (page_insert(dstenv->env_pgdir, pp,  dstenv->env_ipc_dstva, perm) < 0)
            return -E_NO_MEM;
    }
    // update target env fields
    dstenv->env_ipc_recving = false;
    dstenv->env_ipc_from = curenv->env_id;
    dstenv->env_ipc_value = value;
    dstenv->env_ipc_perm = perm;
    dstenv->env_status = ENV_RUNNABLE;
    dstenv->env_tf.tf_regs.reg_eax = 0;
    return 0;


}

```
### ipc_recv()
``` C
int32_t
ipc_recv(envid_t *from_env_store, void *pg, int *perm_store)
{
    // LAB 4: Your code here.
    //panic("ipc_recv not implemented");
    int r;
    void *va;


    if (pg != NULL)
        va = pg;
    if (pg == NULL)
        va = (void *)-1;

    //system call failed
    if (sys_ipc_recv(va) < 0) {
        *from_env_store = 0;
        *perm_store = 0;
    }

    //store infomation for caller
    if (from_env_store)
        *from_env_store = thisenv->env_ipc_from;
    if (perm_store)
        *perm_store =  thisenv->env_ipc_perm;

    return thisenv->env_ipc_value;
}
```
### ipc_send()
``` C
void
ipc_send(envid_t to_env, uint32_t val, void *pg, int perm)
{
    // LAB 4: Your code here.
    //panic("ipc_send not implemented");
    int r;
    void *va;

    if (!pg)
        va = (void *)-1;
    else
        va = pg;

    while (1) {
        r = sys_ipc_try_send(to_env, val, va, perm);
        if (r == 0)
            break;
        if (r < 0 && r != -E_IPC_NOT_RECV)
            panic("error on send ipc_send, %e", r);
        if (r == -E_IPC_NOT_RECV)
            sys_yield();
    }

}
```

梳理一个过程(pingpong程序)：
`sys_ipc_recv`将当前env设置为不可运行状态后调用调度程序，发送方开始执行检查并且配置自己和接收方内存空间的页映射等相关信息，设置完后通过return返回到`trap()`函数，通过env_run()返回用户态，准备执行`ipc_recv`接收刚才接收方的消息，执行调度。接收方的用户环境已经设置为可运行状态，从而开始执行`env_run`，此时这个环境中eax的值还是之前系统调用号`12`，如果运行`env_tf_pop`会直接回到调用的地点引发错误。所以，发送方应该将接收方的eax置为0表示接收成功。

# make grade

``` C
make[1]: Leaving directory '/home/moonlight/lab'
dumbfork: OK (1.4s)
Part A score: 5/5

faultread: OK (0.9s)
faultwrite: OK (1.0s)
faultdie: OK (2.0s)
faultregs: OK (2.0s)
faultalloc: OK (1.0s)
faultallocbad: OK (1.8s)
faultnostack: OK (1.1s)
faultbadhandler: OK (1.9s)
faultevilhandler: OK (2.2s)
forktree: OK (2.0s)
Part B score: 50/50

spin: OK (1.9s)
stresssched: OK (3.4s)
sendpage: OK (1.8s)
    (Old jos.out.sendpage failure log removed)
pingpong: OK (2.0s)
    (Old jos.out.pingpong failure log removed)
primes: OK (13.9s)
    (Old jos.out.primes failure log removed)
Part C score: 25/25

Score: 80/80
moonlight@ubuntu:~/lab$
```


>Challenge 1:solute the `ipc_send` loop

//todo here , reading IA32
1. ipc_send use `ipc_find_env` firstly to find corrsponding env whose status is runnable
2. call `sys_ipc_try_send`
3. for the status of target env is running ,I should send an IPC interrupt using  `lapic_ipi()` function in the file `lapic.c`.
4. makes it runnable
5. call `sys_ipc_try_send`

---

> thread introduction : http://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-35.pdf

> kernel design : https://github.com/fATwaer/fatwaer.github.io/tree/master/pdf/os/SRC-RR-35.pdf


# 总结
上面两篇paper非常值得一看，JOS到目前为止都没用到thread这个概念，但是在接下来的学习中是非常重要的，另外一直没有看完的是IA32手册，这份手册提供了很多操作系统的细节，虽然没必要全部读完，但是我觉得至少把个位数的章节读完是很有必要的。

Lab4到这里已经结束了，从5.7到5.19大概花了两周的时间，不同部分的代码依赖很强，一点不小心就会引发非常严重的错误。不过在这个实验中，第一次听说了回归测试这个概念，应该与单元测试功能相同，是为大型程序阶段性检测的一种技巧。JOS替换了进程的叫法，称之为“用户环境”。在实验中可以体会到，一个用户环境的创建包括很多过程，页表，页映射，当前执行的CPU，错误处理机制，正常栈，异常栈等等信息都要提前准备好才把这个进程设置为可运行状态，所准备的一切都是为一个需要执行的任务做下铺垫。


