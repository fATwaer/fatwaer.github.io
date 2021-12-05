---
title: "Protection Mechanism on 80386"
date: 2019-11-11T12:34:17+08:00
draft: false
categories:
  - sys

---

80386 下的保护模式划为5个部分：

1. 类型检查
2. 界限检查
3. 可寻址域的限制
4. 过程调用的限制
5. 指令集的限制

事实上按照段页机制又需要分为段机制下的保护和页机制下的保护。


# 段级别的保护


段描述符中存储了保护参数，当段描述符到段寄存器中和访问相应的段时，CPU 会自动启用保护机制进行检测。

> 段描述符格式

![fig6-1.gif](/images/operating-system/6.828/protection/fig6-1.gif)

上图中一共有三种段，除了常被应用程序使用的数据段和可执行段外，还有一种用作门（gate）的描述符。

当段寄存器加载一个段的时候，不仅仅只是加载了段的基地址，还会加载其他的保护机制所需要用到的信息。在段寄存器的不可见部分存储了段基地址，界限，特权等级，所以在保护机制在检查合法性时没有额外的时钟周期损耗。

![segment-register.png](/images/operating-system/6.828/protection/segment-register.png)

## 段机制的类型检查

描述符中的 TYPE 域用来区分不同描述符的格式和描述符的作用。

- 在数据段的 writable bit 代表正在执行的指令可否写入到该段。
- 代码段中的 readable bit 代表正在执行的指令能否读取该段中的数据，例如操作数为常量的情况。

    一个可读可执行的段可以被两种形式加载：
    1. 通过 CS 寄存器，例如 ljmp cs:addr
    2. 加载到通用段寄存器中

类型检查会在两种情况下进行：

1. 当描述符被加载到到段寄存器时，相应的段寄存器只能加载对应的描述符种类，例如：
    - CS 寄存器只能加载可执行的段
    - 不可读但是可执行的段不能被加载到数据段寄存器中
    - 只有科协的数据段能被加载到SS寄存器

2. 当指令显式或者隐式地引用段寄存器，相应的段只能被预先定义好的方式来使用，例如：
    - 不能尝试往可执行的段中写入
    - 不能往w位未置位的数据段中写入
    - 不能读取r位未置位的可执行段（数据段默认可读）

## 段机制的界限检查

故名思意，界限（limit）域在描述符中被处理器阻止程序寻址到超出段界限外的地方，与段界限相关的还有 G (granularity) bit，对于数据段，还有 E-bit (expansion-direction bit) 和 the B-bit (big bit)。

> bit 组合

![table6-2.png](/images/operating-system/6.828/protection/table6-2.png)


除去 expand-down 类型的数据段，下列这些情况会产生一般保护错误（general-protection exception）：

1. 尝试访问1字节的地址，地址大于界限
2. 尝试访问1字的地址，地址大于等于界限
3. 尝试访问2字的地址，地址大于等于界限值-2

界限的检查能捕获一些程序的运行错误例如非法的指针计算。这些错误会在刚刚发生时被检测到，所以检测这些错误更加简单，如果没有这个机制，这些错误可能会影响到其他的部件，到那时候再去追踪就难多了。




### 特权等级

特权等级分为四级，但是基本只会用到两级，最高特权级别 ring 0和最低的特权级别 ring 3。

![ring.png](/images/operating-system/6.828/protection/ring.png)

特权等级在以下这些地方展现：


- CPL(Current privilege level): CPL 代表当前正在运行的程序或者任务的权限等级，存储在CS或者SS段寄存器的第0和1位。通常CPL和当前运行的代码段的等级相同，当CPL发生改变时，代表程序在不同特权等级之间的控制转移。

    但是当代码段描述符的 conforming 位置位时，情况有所不同，conforming 置位的代码段能被特权等级与其相等或者更低权限的任务所访问，并且，在执行 conforming 置位的代码时，CPL不会发生改变，所以通常 conforming 代码段用于低权限任务需要执行数学函数或者异常处理函数等情况。

- DPL(descriptor privilege level): 在段描述符或者门描述符中存在一个域用于表明这个描述符的特权等级，当正在执行的代码段尝试去访问一个段或者门时，CPL和RPL就会与DPL进行比较，DPL根据段或门的类型不同会有不同的解释方法：

    - 数据段：DPL代表可以访问该段的最低权限，比如数据段的DPL位1，仅只有程序运行在CPL为0或1时才能访问该段。
    - 非 conforming 的代码段（不使用 call gate）：DPL代表程序必须运行在的特权等级（即使特权等级大于DPL也不行）
    - Call gate：DPL代表可以访问该段的最低权限，同数据段
    - 使用call gate 访问代码段：DPL代表可以访问该段的最高权限，比如某个代码段的DPL为2，运行在特权等级 0 或者 1 的程序无法访问。
    - TSS：DPL代表可以访问该段的最低权限，同数据段

- RPL(Requested privilege level): RPL 是存储在段选择子第0 和 1 位，处理器在检查特权等级时会同时检查 CPL 和 RPL。即使程序运行的特权等级 (CPL) 已经满足了相应段的特权等级 (DPL)，如果 RPL 不能满足 DPL 的话，访问段的操作仍然会被拒绝。这意味着，如果 RPL 树枝上大于 CPL，那么RPL将会作为尝试去访问相应段的特权等级，反之亦然。RPL 可以被保证 特权代码不会代表应用程序去访问一个该应用程序并没有权限的段。

    ![segment-register-format.png](/images/operating-system/6.828/protection/segment-register-format.png)

    关于 RPL 的作用在  Intel® 64 Developer’s Manual : **4.10.4 Checking Caller Access Privileges (ARPL Instruction)** 里面有几个例子进行说明。

    当一个应用程序过程(the calling procedure)调用操作系统 的一个过程(the called procedure)时，在执行操作系统过程中会将特权等级设置为应用程序的段选择子的 RPL。当操作系统尝试去访问相关的段时，处理器会对 RPL 而不是特权等级值更低的 CPL（此时为0）进行特权等级检查。

    ![rpl.png](/images/operating-system/6.828/protection/rpl.png)

    在上图中，应用程序正运行在代码段A中，处理数据段D1中的数据，此时在数据段D1中指向了一个特权数据结构（在数据段D中的操作系统数据结构，数据段的 DPL 为0）。因为 CPL 的值大于特权等级值，权限不足以访问。

    为了访问到数据段 D，应用程序执行了一个调用，并且通过栈传递了段选择子 D1（存在RPL） 到操作系统。在传递段选择子前，应用程序会将段选择子设置为当前的 CPL （SS或者CS中）。当通过门 C （运行在特权等级0）利用段选择子 D1 （栈上的值）访问数据段 D时，由于D1的RPL要大于DPL，访问数据段 D 的操作被拒绝。

    该部分后面还有一种情况，通过门调用时，由于应用程序可以修改栈上的段选择器中的 RPL 值（对应图中数据段D2），这会导致保护机制被破坏，于是有了 ARPL 指令对栈上的 RPL 和调用此操作系统过程的程序的 CPL 进行比较。


## 段机制的数据的访问限制

为了访问到在内存中的操作数，程序必须将数据段加载到数据段(DS, ES, FS, GS, SS)寄存器中。处理器会在访问数据段时自动比较特权等级。

![fig6-3.gif](/images/operating-system/6.828/protection/fig6-3.gif)

数据段寄存器能加载一个数据段的前提是DPL大于RPL和CPL。

## 段机制的控制转移限制

控制转移往往伴随着JMP, CALL, RET, INT, IRET指令以及中断和异常机制。在同一个代码段的JMP, CALL, RET仅仅只有段界限检查。远距离的调用或者跳转会引用到其他段，因此，处理器会进行特权检查。

例如：ljmp   $0x8,$0x7c32，$0x8为段寄存器值。

JMP 或者 CALL 会通过两种方式引用另外一个段：

1. 操作数中存在另一个可执行的代码段描述符
2. 操作数中有一个调用门描述符

一般情况下，处理器正在运行的代码段的 DPL 和 CPL 相等，但是如果代码段的 conforming 位置位时，CPL 可能大于 DPL。所以只有当 DPL 和 CPL 相等时或者代码段的conforming 位置位并且 DPL 小于等于 CPL 时，JMP和CALL能够直接从原先的代码段跳转到另一个代码段。


> 代码段的检查

![fig6-4.gif](/images/operating-system/6.828/protection/fig6-4.gif)

### 门限描述符对过程调用的保护

一共有4中描述符用于在不同特权等级间进行跳转：

- call gate
- Trap gates
- Interrupt gates
- Task gates

call gate 和普通描述符一样，定义在GDT或者LDT中，它定义了一个过程调用的入口和调用该过程所需要的特权等级。call gate描述符对于jmp和call指令来说和代码段的处理方式一样。

> call gate

![fig6-5.gif](/images/operating-system/6.828/protection/fig6-5.gif)

selector 和 offset 域能形成一个到调用过程入口的指针，call gate 保证能跳转到另一个段的合法地址，而不是跳转到一个过程调用的中间或者....一条指令的中间。一条指令的控制转移的偏移地址不会在call gate跳转中使用（前面那种跳转到中途的情况）。


![fig6-6.gif](/images/operating-system/6.828/protection/fig6-6.gif)

执行指令时，首先通过操作数中的段选择器得到门限描述符的偏移，在门限描述符中的 selector 字段获得目标调用过程的代码段描述符，执行过程调用，在这过程中，一共涉及到4个特权等级，CPL，RPL，门限的 DPL 和目标代码段的 DPL。

![fig6-7.gif](/images/operating-system/6.828/protection/fig6-7.gif)


通过 gate 可以实现不同特权等级的转移，但是只有通过 call 指令能切换到更低的特权等级上，而 jmp 指令只能在同特权等级之间跳转（不考虑comforming 代码段）。

对于 jmp 指令，要求：

```
MAX (CPL,RPL) <= gate DPL
target segment DPL = CPL
```

对于 call 指令或者 jmp 目的代码段为 comforming：

```
MAX (CPL,RPL) <= gate DPL
target segment DPL <= CPL
```

### 栈切换

为了维护系统的整体性，任意特权等级拥有各自独立的栈，处理器通过TSS（task state segment）定位这些不同特权等级的栈。比如通过call gate切换特权等级时，新的栈指针将会从tss中读取出来。

> TSS

![fig6-8.gif](/images/operating-system/6.828/protection/fig6-8.gif)

处理器会利用目标代码段的DPL找到对应特权等级（PL 0，1，2）的栈，并且 DPL 必须与 CPL 相等。TSS 中没有对应特权等级为3的栈，因为特权等级3的过程不能被其他任意低于其特权等级的过程调用。每个栈都必须有足够的空间去存储 ss:esp，返回地址，参数等。

为了在不同特权等级之间调用过程，处理器必须将调用者的参数从旧的栈帧中拷贝到新特权等级的栈帧中去。call gate 描述符中的 count 字段代表多少双字（doublewords）需要拷贝，如果count为0，拷贝就不会发生。

> 切换特权等级的栈切换：

![fig6-9.gif](/images/operating-system/6.828/protection/fig6-9.gif)

1. 新栈检查是否有足够的空间容纳参数等，否则产生一个栈错误，错误代码设置为0.
2. 将旧栈SS:ESP压入新栈（占用两个双字）
3. 复制剩下的参数
4. 调用者的call的下一条指令地址以 CS:EIP 压入新栈
5. 将新的 SS:ESP 指向新栈栈顶

### 从过程调用中返回（ret）

和 call 指令类似，同一个代码段之间的 ret 只有界限检查。对于段间的 ret，首先会弹出由 call 压入的返回地址，通常情况下时合法的，但是也有可能由于调用过程替换掉了这个地址或者没有很好地维护栈，这个返回地址也是不可信的，所以权限检查还是会有的。

段之间的 ret 只能返回到与其相等或者更高特权值的等级去，当栈上保存的 CS 中的 RPL 大于当前的 CPL 时，特权等级间的控制转移就会发生：

1. 检查下表中的内容，加载栈上的 CS:EIP 和 SS:ESP 到相应寄存器。
2. 原先的栈指针会被 ret 指令做相应的调整，此时 esp 的值不会进行界限检查，如果 esp 实在超出了界限，那么下次对栈的操作将会产生错误。
3. 基础段寄存器的特权值将会被检查，如果这些段寄存器引用了那些 DPL 大于新 CPL（栈上保存的CS得到） 的段，那么段寄存器就会加载 null selector，即 GDT 中的一个 null 描述符（INDEX = 0, TI = 0）。并且，此时不会产生异常，直到下次操作相应段内存时产生一般保护异常。



```
SF = Stack Fault
GP = General Protection Exception
NP = Segment-Not-Present Exception

Type of Check                                  Exception   Error Code

ESP is within current SS segment               SF          0
ESP + 7 is within current SS segment           SF          0
RPL of return CS is greater than CPL           GP          Return CS
Return CS selector is not null                 GP          Return CS
Return CS segment is within descriptor
  table limit                                  GP          Return CS
Return CS descriptor is a code segment         GP          Return CS
Return CS segment is present                   NP          Return CS
DPL of return nonconforming code
  segment = RPL of return CS, or DPL of
  return conforming code segment <= RPL
  of return CS                                 GP          Return CS
ESP + N + 15 is within SS segment
N   Immediate Operand of RET N Instruction     SF          Return SS
SS selector at ESP + N + 12 is not null        GP          Return SS
SS selector at ESP + N + 12 is within
  descriptor table limit                       GP          Return SS
SS descriptor is writable data segment         GP          Return SS
SS segment is present                          SF          Return SS
Saved SS segment DPL = RPL of saved
  CS                                           GP          Return SS
Saved SS selector RPL = Saved SS
  segment DPL                                  GP          Return SS
```


## 指令集的限制

影响到保护机制的指令分为两类，特权指令，通常被用于系统控制；敏感指令，通常被用作 IO或者 IO相关的操作。

特权指令如下：

```
CLTS -- Clear Task-Switched Flag
HLT -- Halt Processor
LGDT -- Load GDL Register
LIDT -- Load IDT Register
LLDT -- Load LDT Register
LMSW -- Load Machine Status Word
LTR -- Load Task Register
MOV to/from CRn -- Move to Control Register n
MOV to /from DRn -- Move to Debug Register n
MOV to/from TRn -- Move to Test Register n
```


# 页级别保护

页级别的保护较为简单，分成有两种：

1. 对可寻址的内存进行限制
2. 类型检查


## 页机制中的寻址限制

> PDE/PTE


![fig6-10.gif](/images/operating-system/6.828/protection/fig6-10.gif)

在页机制中，特权等级被分为了两级：

1. Supervisor level (U/S=0) ：对应操作系统的软件和相关数据
2. User level (U/S=1)：对于应用程序级别的过程和数据

页机制中的特权等级和段机制中的 CPL 相关联，CPL 处于 ring 0,1,2 代表处理器执行在 supervisor level， CPL 处于 ring 3 代表执行在 user level。

当处理器执行在 user level ，只能寻址那些属于用户级别的页，如果处于  supervisor level ，那么处理器能够寻址所有的页。

## 页机制中的类型检查

对于所有的页，定义了两种类型页，分别为只读的和可读可写类型的。当处于supervisor并且CR0寄存器中的WP位没有置位，所有的页都是可读可写的。而处于 user 级别，就需要对应读写位分情况讨论。处于 user 级别时，对于supervisor 的所有的页都是不可读写的。




**参考资料**：

[Intel® 64 and IA-32 Architectures Software Developer’s Manual, Volume 1](https://pdos.csail.mit.edu/6.828/2018/readings/ia32/IA32-1.pdf)

[6.828 readings, Protection](https://pdos.csail.mit.edu/6.828/2018/readings/i386/c06.htm)

