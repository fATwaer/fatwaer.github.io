---
title: '6.828-操作系统工程-Lab3:User Environments'
categories:
  - sys
date: 2018-04-22 23:01:09
tags:
  - OS
---
> 4月22日 - 5月2日

# PART A

这章的练习将会取实现一些基础的用户模式下的环境，也就是进程。在这章，创建一个用户环境，读取程序镜像并且运行。
这是关于这章节代码文件的介绍
```
inc/env.h   Public definitions for user-mode environments
    trap.h  Public definitions for trap handling
    syscall.h   Public definitions for system calls from user environments to the kernel
    lib.h   Public definitions for the user-mode support library
kern/env.h   Kernel-private definitions for user-mode environments
    env.c   Kernel code implementing user-mode environments
    trap.h  Kernel-private trap handling definitions
    trap.c  Trap handling code
    trapentry.S Assembly-language trap handler entry-points
    syscall.h   Kernel-private definitions for system call handling
    syscall.c   System call implementation code
lib/Makefrag    Makefile fragment to build user-mode library, obj/lib/ libjos.a
    entry.S Assembly-language entry-point for user environments
    libmain.c   User-mode library setup code called from entry.S
    syscall.c   User-mode system call stub functions
    console.c   User-mode implementations of putchar and getchar, providing console I/O
    exit.c  User-mode implementation of exit
    panic.c User-mode implementation of panic
user/   *   Various test programs to check kernel lab 3 code

```

# 内联汇编

简单描述:

    __asm__(汇编语句模板: 输出部分: 输入部分: 破坏描述部分)

[具体详情](http://www.ibiblio.org/gferg/ldp/GCC-Inline-Assembly-HOWTO.html)

# 文件概述

在文件`inc/env.h`中定义了`Env`结构体，用来存储一些关于用户环境(进程)的结构体。

``` C
struct Env {
    struct Trapframe env_tf;    // Saved registers
    struct Env *env_link;       // Next free Env
    envid_t env_id;         // Unique environment identifier
    envid_t env_parent_id;      // env_id of this env's parent
    enum EnvType env_type;      // Indicates special system environments
    unsigned env_status;        // Status of the environment
    uint32_t env_runs;      // Number of times environment has run

    // Address space
    pde_t *env_pgdir;       // Kernel virtual address of page dir
};

```


在这个结构体中，`env_status`用来指示当前进程的状态，有以下几种定义在一个枚举类型里面。

``` C
enum {
    ENV_FREE = 0,
    ENV_DYING,
    ENV_RUNNABLE,
    ENV_RUNNING,
    ENV_NOT_RUNNABLE
};

```



文件`kern/env.c`文件中，有三个文件域的定义。
``` C
struct Env *envs = NULL;        // All environments
struct Env *curenv = NULL;      // The current env
static struct Env *env_free_list;   // Free environment list

```

`envs`指向保存所有`Env`结构体的内存页，并且指向虚拟内存`UTOP`。

`curenv`是字面意思，指向当前执行的进程。

`env_free_list`是一个链表表头，类似之前的`page_free_list`。


# 练习1

>分配NENV个Env结构体，并且用envs指针指向它们

---

``` C
// Make 'envs' point to an array of size 'NENV' of 'struct Env'.
envs = (struct Env *)boot_alloc(NENV * sizeof(struct Env));
memset(envs, 0, NENV * sizeof(struct Env));

// Map the 'envs' array read-only by the user at linear address UENVS
// (ie. perm = PTE_U | PTE_P).
boot_map_region(kern_pgdir, UENVS, PTSIZE, PADDR(envs), PTE_U | PTE_P);
```

# 练习2

>创建并且运行进程

完成以下函数:
```
env_init()
    Initialize all of the Env structures in the envs array and add them to the
    env_free_list. Also calls env_init_percpu, which configures the
    segmentation hardware with separate segments for privilege level 0 (
    kernel) and privilege level 3 (user).
env_setup_vm()
    Allocate a page directory for a new environment and initialize the kernel
    portion of the new environment's address space.
region_alloc()
    Allocates and maps physical memory for an environment
load_icode()
    You will need to parse an ELF binary image, much like the boot loader
    already does, and load its contents into the user address space of a new
    environment.
env_create()
    Allocate an environment with env_alloc and call load_icode to load an ELF
    binary into it.
env_run()
    Start a given environment running in user mode.
    As you write these functions, you might find the new cprintf verb %e
    useful -- it prints a description corresponding to an error code. For
    example,

r = -E_NO_MEM;
panic("env_alloc: %e", r);
will panic with the message "env_alloc: out of memory".
```

---

## env_init()

``` C
void
env_init(void)
{
    // Set up envs array
    // LAB 3: Your code here.
    int i;

    for (i = NENV - 1; i >= 0; i--) { // reversal order
        envs[i].env_id = 0;
        envs[i].env_status = ENV_FREE;
        envs[i].env_link = env_free_list;
        env_free_list = &envs[i];
    }

    // Per-CPU part of the initialization
    env_init_percpu();

}
```

## env_setup_vm()

``` C
static int
env_setup_vm(struct Env *e)
{
    int i;
    struct PageInfo *p = NULL;

    // Allocate a page for the page directory
    if (!(p = page_alloc(ALLOC_ZERO)))
        return -E_NO_MEM;


    // LAB 3: Your code here.
    e->env_pgdir = (pte_t *)page2kva(p);
    p->pp_ref++;

    /* copy structs to UTOP*/
    memcpy(e->env_pgdir, kern_pgdir, PGSIZE);

    // UVPT maps the env's own page table read-only.
    // Permissions: kernel R, user R
    e->env_pgdir[PDX(UVPT)] = PADDR(e->env_pgdir) | PTE_P | PTE_U;

    return 0;
}
```

## region_alloc()

``` C
static void
region_alloc(struct Env *e, void *va, size_t len)
{
    // LAB 3: Your code here.
    // (But only if you need it for load_icode.)
    //
    // Hint: It is easier to use region_alloc if the caller can pass
    //   'va' and 'len' values that are not page-aligned.
    //   You should round va down, and round (va + len) up.
    //   (Watch out for corner-cases!)
    uintptr_t va_beg = ROUNDDOWN((uint32_t)va, PGSIZE);
    uintptr_t va_end = ROUNDUP((uint32_t)(va+len), PGSIZE);
    uintptr_t i;

    for (i = va_beg; i < va_end; i += PGSIZE) {  /* maps each page to pa */
        struct PageInfo *p;
        if (!(p = page_alloc(ALLOC_ZERO)))
            panic("lack of free pages");

        if ((page_insert(e->env_pgdir, p, (void *)i, PTE_P | PTE_U | PTE_W)) == -E_NO_MEM)
            panic("lack memmory");

    }

}

```

## load_icode()

``` C
static void
load_icode(struct Env *e, uint8_t *binary)
{
    // LAB 3: Your code here.
    /* user mode */
    lcr3(PADDR(e->env_pgdir));

    struct Elf *elf = (struct Elf *)binary;

    /* check file format */
    if (elf->e_magic != ELF_MAGIC)
        panic("load_icode() : format error ");

    if (elf->e_entry == 0)
        panic("load_icode() : ELF file loads failed");

    e->env_tf.tf_eip = elf->e_entry;

    struct Proghdr *ph, *eph;
    ph = (struct Proghdr *)(binary + elf->e_phoff);
    eph = ph + elf->e_phnum;

    for (; ph < eph; ph++) {
        if (ph->p_type == ELF_PROG_LOAD) {
        region_alloc(e, (void *)(ph->p_va), ph->p_memsz);

        memcpy((void *)ph->p_va, (void *)binary + ph->p_offset, (size_t)(ph->p_filesz));
        }
    }

    lcr3(PADDR(kern_pgdir));
    // Now map one page for the program's initial stack
    // at virtual address USTACKTOP - PGSIZE.
    // LAB 3: Your code here.
    region_alloc(e, (void *)USTACKTOP-PGSIZE, PGSIZE);
}

```

## env_create()

``` C
void
env_create(uint8_t *binary, enum EnvType type)
{
    // LAB 3: Your code here.
    struct Env * env;
    if (env_alloc(&env, 0) < 0)
        panic("env_alloc error !");


    load_icode(env, binary);
    env->env_type = type;
}

```

## env_run()

``` C
void
env_run(struct Env *e)
{
    if (curenv != NULL && curenv->env_status == ENV_RUNNING)
        curenv->env_status = ENV_RUNNABLE;

    curenv = e;

    curenv->env_status = ENV_RUNNING;
    curenv->env_runs++;
    lcr3(PADDR(curenv->env_pgdir));

    env_pop_tf(&(curenv->env_tf));
    // Hint: This function loads the new environment's state from
    //  e->env_tf.  Go back through the code you wrote above
    //  and make sure you have set the relevant parts of
    //  e->env_tf to sensible values.

    // LAB 3: Your code here.

    //panic("env_run not yet implemented");
}

```

代码完成后应该还是会无限重启，因为，在执行完`env_pop_tf`的时候会去调用用户自己写的代码，但是会要用到从用户态到内核态的跳转，这部分代码并没有完成。
```
start (kern/entry.S)
i386_init (kern/init.c)
    cons_init
    mem_init
    env_init
    trap_init (still incomplete at this point)
    env_create
    env_run
    env_pop_tf
```
在qemu上运行这个内核，如果调用了成功执行到env_pop_tf的话，基本成功了。此时，内核会去执行一个`hello`的二进制文件，但是会用到系统调用和使用`int`中断指令。但是此时的JOS并没有完成用户空间到内核空间的跳转。CPU发现没有办法解决这个的办法，于是生成一个__二重错误异常__，然后继续发现还是没有办法去处理这个错误机制，于是引发__三重错误异常__，这时候，CPU就会要重置，使得整个系统重新启动。这就是现在看到的无限重启的行为。

用`make-qemu`和`make gdb`编译出内核，用`break env_pop_tf`在函数env_pop_tf处设置断点，单步执行，看能否能进入hello.asm中，地址在用户内存空间(0x08000000+)。然后在`obj/user/hello.asm`中找到`sys_cputs`中的`int $0x30`指令。如果成功执行到了这儿，说明之前的代码没有问题。


# 练习3
阅读[Chapter 9, Exceptions and Interrupts](https://pdos.csail.mit.edu/6.828/2017/readings/i386/c09.htm)

---

中断是外部发给CPU的信号，而异常是CPU在自己处理命令时候出现的错误。
其中中断分为可屏蔽和不可屏蔽的。

异常也有三种(Faults/Traps/Aborts)，Faults异常是在执行这条指令之前就被指出的错误，但是如果在执行的过程中遇到了faults级的错误，CPU将会让机器保存状态，并且允许被修正重新执行。

第二种是Traps异常，是一种执行完后立即报告的异常，允许程序连续性执行，异常处理的返回地址就是trap指令后的那条。

第三种是Aborts异常，这种异常不报告异常发生的精确位置，也不运行程序继续往下执行。往往是发生了严重的错误，例如硬件错误和不合法的数值。

```
Table 9-1. Interrupt and Exception ID Assignments

Identifier   Description

0            Divide error
1            Debug exceptions
2            Nonmaskable interrupt
3            Breakpoint (one-byte INT 3 instruction)
4            Overflow (INTO instruction)
5            Bounds check (BOUND instruction)
6            Invalid opcode
7            Coprocessor not available
8            Double fault
9            (reserved)
10           Invalid TSS
11           Segment not present
12           Stack exception
13           General protection
14           Page fault
15           (reserved)
16           Coprecessor error
17-31        (reserved)
32-255       Available for external interrupts via INTR pin
```

---

`IF`(interrput-enable flag)是控制屏蔽外中断的标志位。当IF=0，中断会被屏蔽，IF=1，中断才会被接收。
CLI (Clear Interrupt-Enable Flag) and STI (Set Interrupt-Enable Flag) explicitly alter IF (bit 9 in the flag register).

`IF`标志位被以下三种情况隐性影响：
- `PUSHF`存储所有flag，包括IF。在栈中的IF，可以被修改。
- 任务切换时，`POP`和`IRET`读取flag寄存器，因此，这步操作能修改IF
- 中断通过interrupt gates(?)能自动重置IF，也就关闭外中断。


---

设置段地址的时候也会发生中断，影响程式的执行。通常设置栈区的段的时候通常使用以下这一对指令。
``` asm
    MOV SS, AX
    MOV ESP, StackTop
```

如果这时候发生中断或者异常，SS已经被设置成了AX，而ESP的值还没被传达到，栈指针，SS:ESP在处理中断和异常的时候是不正常的，所以80386CPU在处理这两条指令的时候会屏蔽NMI, INTR, debug exceptions, and single-step traps这些中断。


# 练习4
>编辑trapentry.S和trap.c安装中断向量，宏TRAPHADNLER和TRAPHANDLER_NOEC可以帮助安装向量，中断向量被定义在inc/trap.h中。然后提供一共_alltraps去准备堆栈。在函数trap_init()中初始化idt中断向量数组，并且使用SETGATE去指向相关的函数。

---

为不同的中断生成入口，两个宏的差别在于是否有[error code](https://pdos.csail.mit.edu/6.828/2017/readings/i386/s09_10.htm)。，如果有的话，硬件会自动将错误信息压栈。如果没有的话，宏`TRAPHANDLER_NOEC`会压入一个0值。

``` asm
TRAPHANDLER_NOEC(divid_entry, T_DIVIDE);
TRAPHANDLER_NOEC(debug_entry, T_DEBUG);
TRAPHANDLER_NOEC(nmi_entry, T_NMI);
TRAPHANDLER_NOEC(brkpt_entry, T_BRKPT);
TRAPHANDLER_NOEC(oflow_entry, T_OFLOW);
TRAPHANDLER_NOEC(bound_entry, T_BOUND);
TRAPHANDLER_NOEC(illop_entry, T_ILLOP);
TRAPHANDLER_NOEC(device_entry, T_DEVICE);
TRAPHANDLER(dblflt_entry, T_DBLFLT);
TRAPHANDLER(tss_entry, T_TSS);
TRAPHANDLER(segnp_entry, T_SEGNP);
TRAPHANDLER(stack_entry, T_STACK);
TRAPHANDLER(gpflt_entry, T_GPFLT);
TRAPHANDLER(pgflt_entry, T_PGFLT);
TRAPHANDLER_NOEC(fperr_entry, T_FPERR);
TRAPHANDLER_NOEC(syscall_entry, T_SYSCALL);
```

`_alltraps`将所有的寄存器状态保存，压栈。

``` asm
_alltraps:
    pushl %ds
    pushl %es
    pushal

    mov $GD_KD, %ax
    mov %ax, %es
    mov %ax, %ds

    push %esp

    call trap
```

![stack.png]( /images/operating-system/6.828/lab3/stack.png)

根据练习提示，将段寄存器`es`和`ds`设置为GDT的kernel数据段，然后将esp压栈，调用trap。

这里直接调用trap就行，调用函数的参数已经在堆栈中，跳转到函数开始的地方就是一个普通的函数调用。

回顾之前的`Lab2`，在`env_run()`之前，会执行`trap_init()`，目的就是为了安装中断向量表。
`trap.c/trap_init()`中，将`idt`数组已知中断全部设置好，并将处理这个中断或者异常的handler安装到GDT中的`.text`域中，并且设置好权限。

``` c
void
trap_init(void)
{
    extern struct Segdesc gdt[];

    // LAB 3: Your code here.
    void divid_entry();
    void debug_entry();
    void nmi_entry();
    void brkpt_entry();
    void oflow_entry();
    void bound_entry();
    void illop_entry();
    void device_entry();
    void dblflt_entry();
    void tss_entry();
    void segnp_entry();
    void stack_entry();
    void gpflt_entry();
    void pgflt_entry();
    void fperr_entry();
    void syscall_entry();

    SETGATE(idt[T_DIVIDE], 1, GD_KT, divid_entry, 0);
    SETGATE(idt[T_DEBUG], 1, GD_KT, debug_entry, 3);
    SETGATE(idt[T_NMI], 1, GD_KT, nmi_entry, 0);
    SETGATE(idt[T_BRKPT], 1, GD_KT, brkpt_entry, 3);
    SETGATE(idt[T_OFLOW], 1, GD_KT, oflow_entry, 0);
    SETGATE(idt[T_BOUND], 1, GD_KT, bound_entry, 0);
    SETGATE(idt[T_ILLOP], 1, GD_KT, illop_entry, 0);
    SETGATE(idt[T_DEVICE], 1, GD_KT, device_entry, 0);
    SETGATE(idt[T_DBLFLT], 1, GD_KT, dblflt_entry, 0);
    SETGATE(idt[T_TSS], 1, GD_KT, tss_entry, 0);
    SETGATE(idt[T_SEGNP], 1, GD_KT, segnp_entry, 0);
    SETGATE(idt[T_STACK], 1, GD_KT, stack_entry, 0);
    SETGATE(idt[T_GPFLT], 1, GD_KT, gpflt_entry, 0);
    SETGATE(idt[T_PGFLT], 1, GD_KT, pgflt_entry, 0);
    SETGATE(idt[T_FPERR], 1, GD_KT, fperr_entry, 0);
    SETGATE(idt[T_SYSCALL], 1, GD_KT, syscall_entry, 3);

    // Per-CPU setup
    trap_init_percpu();
}
```


>Q1:What is the purpose of having an individual handler function for each exception/interrupt? (i.e., if all exceptions/interrupts were delivered to the same handler, what feature that exists in the current implementation could not be provided?)

不同的权限组应该要有不同的解决办法。

>Q2:Did you have to do anything to make the user/softint program behave correctly? The grade script expects it to produce a general protection fault (trap 13), but softint's code says int 14. Why should this produce interrupt vector 13? What happens if the kernel actually allows softint's int 14 instruction to invoke the kernel's page fault handler (which is interrupt vector 14)?

`user/softint`用户程序中就只有一句:

    asm volatile ("int $14");
用来产生`page fault`，但是这是用户程序产生的。一般产生页错误，查看page fault的处理办法`page_fault_handler()`中`env_destroy(curenv);`会将这个用户环境销毁。一般用户应该没有这样的权限。

所以对于权限不够的用户，应该产生`General protection fault `。


This concludes part A of the lab.


---

# PART B

这一部分解决__Page Faults, Breakpoints Exceptions, System Calls__

`_alltraps`会调用traps
`traps`可以分为四个部分
1. 关闭中断
``` C
    asm volatile("cld" ::: "cc");
    assert(!(read_eflags() & FL_IF));
```

2. 如果是用户模式，复制一份用户栈。
```
    if ((tf->tf_cs & 3) == 3) {
        assert(curenv);
        curenv->env_tf = *tf;
        tf = &curenv->env_tf;
    }
    last_tf = tf;
```

3. 处理中断
```
    trap_dispatch(tf);
```

4. 如果这个用户环境未被销毁，那么继续执行。
```
    assert(curenv && curenv->env_status == ENV_RUNNING);
    env_run(curenv);
```

---

# 练习5 , 6
> 让14号中断调用page_fault_handler()函数

> breakpoint异常，3号中断通常是用来给调试器使用，它允许程序代码临时性地代替程序指令。在JOS中使用monitor()来执行处理异常。
---
`page_fault_handler`函数中通过`fault_va = rcr2()`获取页出错的虚拟地址。

这两个练习都是在`trap_dispatch`中修改，代码如下。
``` C
    // Handle page fault exceptions.
    if (tf->tf_trapno == T_PGFLT) {
        page_fault_handler(tf);
        return ;
    }

    // after int 3 interrupt , this function
    // uses panic() to output debugger infomations.
    if (tf->tf_trapno == T_BRKPT) {
        monitor(tf);
        return ;
    }
```

# Challenge

//想做做不出来...留个思路

1. monitor中执行函数
2. 激活tf栈中的eflags中TF位，开启单步调试
3. 然后使用`IRET`返回中断，弹栈。
[optional](https://pdos.csail.mit.edu/6.828/2017/labs/lab3/#Exercise-6)

>Q1:The break point test case will either generate a break point exception or a general protection fault depending on how you initialized the break point entry in the IDT (i.e., your call to SETGATE from trap_init). Why? How do you need to set it up in order to get the breakpoint exception to work as specified above and what incorrect setup would cause it to trigger a general protection fault?

`interrupt gate`中`DPL`影响这两种情况，当调用的时候，`eflags`中的`CPL`的值大于DPL的时候会产生`general protection fault`，因为特权等级不够。

>Q2:What do you think is the point of these mechanisms, particularly in light of what the user/softint test program does?

用户不能产生14中断，特权级不够。


# 练习7
>完成系统调用

---

用户通过系统调用进入内核态，并且保存用户的状态信息，内核执行合适的处理代码，然后恢复到用户态，当然，也需要确定调用是从内核态到用户态还是内核自身调用系统函数。
JOS中系统调用的中断号是0x30，不会由计算机硬件产生，所以需要写好相应的调用代码。

应用程序将会把系统调用的编号和系统调用的参数保存在寄存器中。system call number将会保存在`%eax`中，接下来最多五个参数分别保存在 `%edx`, `%ecx`, `%ebx`, `%edi`, `%esi`中。system call函数已经写好在了文件`lib/syscall.c`中。


## trap_init()

在`trap_init()`中添加相应的handler:

``` C
    void syscall_entry();

    ...

    ...

    SETGATE(idt[T_SYSCALL], 1, GD_KT, syscall_entry, 3);

```

## trap_dispatch()

然后在`trap_dispatch()`中为中断添加调用：

``` C
    // system call
    if (tf->tf_trapno == T_SYSCALL) {
        tf->tf_regs.reg_eax = syscall(
                tf->tf_regs.reg_eax, tf->tf_regs.reg_edx,
                tf->tf_regs.reg_ecx, tf->tf_regs.reg_ebx,
                tf->tf_regs.reg_edi, tf->tf_regs.reg_esi);
        return ;
    }

```

---

## syscall()

利用`lib/syscall.c`中的syscall进行转移到真正处理通用系统调用的文件中，根据`inc/syscall.h`中的enum定义分发到相应的系统调用的处理函数去。

``` C
// Dispatches to the correct kernel function, passing the arguments.
int32_t
syscall(uint32_t syscallno, uint32_t a1, uint32_t a2, uint32_t a3, uint32_t a4, uint32_t a5)
{
    // Call the function corresponding to the 'syscallno' parameter.
    // Return any appropriate return value.
    // LAB 3: Your code here.

    cprintf("call number:%d  \n", syscallno);
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

    default:
        return -E_INVAL;
    }
}
```

完成这里，利用`make run-hello`检测自己的系统调用是否成功。

# 练习8

用户程序从这里开始执行，确认好相关信息后跳转到 `libmain`执行。
``` asm
.text
.globl _start
_start:
    // See if we were started with arguments on the stack
    cmpl $USTACKTOP, %esp
    jne args_exist

    // If not, push dummy argc/argv arguments.
    // This happens when we are loaded by the kernel,
    // because the kernel does not know about passing arguments.
    pushl $0
    pushl $0

args_exist:
    call libmain
1:  jmp 1b
```

将`libmain()`改成

``` C
    // LAB 3: Your code here.
    thisenv = envs + ENVX(sys_getenvid());
```

ENVX宏定义在`env.h`文件中。
然后接下来调用用户程序`umain`和`exit()`，`umain`就相当于平时执行的C程序中main函数，`exit()`执行系统调用函数`sys_env_destroy()`。

# 练习9/10
修改kern/trap.c,当内核页错误的时候调用`panic`，检查tf_cs的低位。
阅读kern/pmap.c中user_mem_assert函数，并且实现user_mem_check函数。
修改kern/syscall.c，检查系统调用的参数。
修改kern/kdebug.c中的debuginfo_eip，调用user_mem_check检查`usd`,`stabs`,`stabstr`。

---

内存保护是操作系统的一个决定性的特性，确保程序的BUG不会影响到其他程序和操作系统自己。

操作系统通常依赖硬件去实现内存保护，当程序使用一个非法的内存地址或者对指定的虚拟地址没有访问权，处理器会中断程序指令并且产生一个fault级别异常，然后陷入内核态，去处理这个操作。如果这个错误可以修复，内核通过代码修复，然后让程序继续运行，否则，摧毁该程序。

一种常见的可以修复的错误就是栈增长，大多数系统初始化一个进程通常只会分配一个stack页，当程序使用这个分配好的栈的更下层的时候，内核将会自动分配更多的空间，当然会有一个分配的最大值。

大多数系统调用接口让用户程序传递一个指针给系统内核，这个指针指向一个用户内存空间的一个可读可写的缓冲区。系统内核通过解引用这个指针和用户程序进行交互，但是存在以下两个问题。
1. 内核态出现页错误比在用户态出现页错误可能更加严重，如果内核在操作自己的数据结构的时候发生了页错误，这是一个内核BUG，解决错误的handler此时应该`panic`。但是当内核解引用用户程序传递过来的指针的时候，内核需要确认这个指针的是属于该用户程序的。

2. 内核的权限通常高于用户程序，用户可能会传递一个内核可以读取，但是该程序不能读取的内存地址。内核需要非常仔细的检查这类指针，因为这样可能会造成隐私信息泄露和破坏内核完整性。


## page_fault_handler()
``` C
    // LAB 3: Your code here.(1)
    if ((tf->tf_cs & 3) == 0)
        panic("kernel page fault");

```

在8086模式下，寄存器CS,DS,ES等被称作段偏移，但是在保护模式下，CS,DS,ES等寄存器被用作段选择子，在`GDT`中选定相应的段，根据全局描述符中的信息，程序只能在相应的内存段中运行，读取，写入，否则会发生中断或者异常。

## `user_mem_check`

``` C
int
user_mem_check(struct Env *env, const void *va, size_t len, int perm)
{
    // LAB 3: Your code here.
    if ((uintptr_t)va >= ULIM)  {
        user_mem_check_addr = (uintptr_t) va;
        return -E_FAULT;
    }


    uintptr_t beg = ROUNDDOWN((uint32_t)va, PGSIZE);
    uintptr_t end = ROUNDUP((uintptr_t)va+len, PGSIZE);
    uintptr_t i;
    pte_t *phaddr_entry;

    for (i = beg; i != end; i += PGSIZE) {
        phaddr_entry = pgdir_walk(env->env_pgdir, (void *)i, false);
        if ( phaddr_entry == NULL || !(*phaddr_entry & PTE_P)  || (*phaddr_entry & perm ) != perm) {
            user_mem_check_addr = i < (uintptr_t)va ? (uintptr_t)va : i;
            cprintf("%x\n", user_mem_check_addr);
            return -E_FAULT;
        }
    }
    return 0;
}

```

`BUG` ： 这里在调用pgdir_walk的时候把env->env_pgdir写成了kern_pgdir，用户一般都不会有内核的地址空间的读写权限，导致`make run`相关程序的时候发生失败。
## sys_cputs()

``` C
    // Check that the user has permission to read memory [s, s+len).
    // Destroy the environment if not.
    // LAB 3: Your code here.
    user_mem_assert(curenv, s, len, PTE_U);
```


## debuginfo_eip()

```
    // Make sure this memory is valid.
    // Return -1 if it is not.  Hint: Call user_mem_check.
    // LAB 3: Your code here.
    if (user_mem_check(curenv, usd, sizeof(struct UserStabData), PTE_U) < 0)
        return -1;

    stabs = usd->stabs;
    stab_end = usd->stab_end;
    stabstr = usd->stabstr;
    stabstr_end = usd->stabstr_end;

    // Make sure the STABS and string table memory is valid.
    // LAB 3: Your code here.
    if (user_mem_check(curenv, stabs, stab_end - stabs, PTE_U) < 0)
        return -1;
    if (user_mem_check(curenv, stabstr, stabstr_end - stabstr, PTE_U) < 0)
        return -1;
```


>Q: run user/breakpoint, you should be able to run backtrace from the kernel monitor and see the backtrace traverse into lib/libmain.c before the kernel panics with a page fault. What causes this page fault? You don't need to fix it, but you should understand why it happens.

// todo

# make grade

``` bash

make[1]: Leaving directory '/home/moonlight/lab'
divzero: OK (1.3s)
softint: OK (1.0s)
badsegment: OK (1.1s)
Part A score: 30/30

faultread: OK (0.9s)
faultreadkernel: OK (1.9s)
faultwrite: OK (1.1s)
faultwritekernel: OK (1.7s)
breakpoint: OK (1.4s)
testbss: OK (1.7s)
hello: OK (2.2s)
buggyhello: OK (2.0s)
buggyhello2: OK (2.1s)
evilhello: OK (1.7s)
Part B score: 50/50

Score: 80/80

```

This completes the lab.



