---
title: '6.828-操作系统工程-Lab2:Memory Management'
categories:
  - sys
date: 2018-04-12 19:18:13
tags:
  - OS
---

## Exercise 1: 内存初始化

在 lab1 中开启了分段和分页，并且初始化了内核页目录（地址存储在CR3中），于是有了下面这样的地址转换机制。

> 地址转换

![地址转换]( /images/operating-system/6.828/lab2/address-translation.png)

首先通过相应段寄存器获得地址基址，然后以虚拟地址作为偏移获得线性地址。线性地址在通过一定的机制，获得实际的物理地址。

线性地址转换过程:

![fig5-8.png]( /images/operating-system/6.828/lab2/fig5-8.png)

段翻译机制输出一个线性地址（Linear address）
Linear address(LA)，用于接下来的转换，在 CR0 寄存器 PG 位未设置的时候，线性地址会被直接作为物理地址。

```
// A linear address 'la' has a three-part structure as follows:
//
// +--------10------+-------10-------+---------12----------+
// | Page Directory |   Page Table   | Offset within Page  |
// |      Index     |      Index     |                     |
// +----------------+----------------+---------------------+
//  \--- PDX(la) --/ \--- PTX(la) --/ \---- PGOFF(la) ----/
//  \---------- PGNUM(la) ----------/
//
// The PDX, PTX, PGOFF, and PGNUM macros decompose linear addresses as shown.
// To construct a linear address la from PDX(la), PTX(la), and PGOFF(la),
// use PGADDR(PDX(la), PTX(la), PGOFF(la)).
```

首先取线性地址的高10位作为页目录索引(Page Directory Index)，共1024个，从 0 ~ 1023。再使用cr3寄存器中的高二十位定位内存中页目录的基址。

![cr3.png]( /images/operating-system/6.828/lab2/cr3.png)

在页目录和页表中，每个单元都是4bytes。
![pagedirectory.png]( /images/operating-system/6.828/lab2/pagedirectory.png)

最后在页目录中的寻址组成为：

![cr3-addressing.png]( /images/operating-system/6.828/lab2/cr3-addressing.png)


每个索引只使用高20位进行寻址，因为页操作的最小粒度为4KB。只需要4个字节的前面20位进行寻址就行了，剩下的比特可以用作其他标志位。

根据前十位索引获得相应的页目录项后，用其前20位作为一个4KB对齐的地址作为页表（Page Table）的基址。然后从线性地址中取出中间的10位作为的索引，得到相应的页表项（Page Table Entry）。

继续从PTE中取出前20位得到4KB对齐的基址，然后从利用线性地址（LA）最后12位作为在这4K页内的偏移，组合得到32位的地址，即最终的物理地址。


下面是JOS需要完成的内存布局。

``` C
/*
 * Virtual memory map:                                Permissions
 *                                                    kernel/user
 *
 *    4 Gig -------->  +------------------------------+
 *                     |                              | RW/--
 *                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *                     :              .               :
 *                     :              .               :
 *                     :              .               :
 *                     |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~| RW/--
 *                     |                              | RW/--
 *                     |   Remapped Physical Memory   | RW/--
 *                     |                              | RW/--
 *    KERNBASE, ---->  +------------------------------+ 0xf0000000      --+
 *    KSTACKTOP        |     CPU0's Kernel Stack      | RW/--  KSTKSIZE   |
 *                     | - - - - - - - - - - - - - - -|                   |
 *                     |      Invalid Memory (*)      | --/--  KSTKGAP    |
 *                     +------------------------------+                   |
 *                     |     CPU1's Kernel Stack      | RW/--  KSTKSIZE   |
 *                     | - - - - - - - - - - - - - - -|                 PTSIZE
 *                     |      Invalid Memory (*)      | --/--  KSTKGAP    |
 *                     +------------------------------+                   |
 *                     :              .               :                   |
 *                     :              .               :                   |
 *    MMIOLIM ------>  +------------------------------+ 0xefc00000      --+
 *                     |       Memory-mapped I/O      | RW/--  PTSIZE
 * ULIM, MMIOBASE -->  +------------------------------+ 0xef800000
 *                     |  Cur. Page Table (User R-)   | R-/R-  PTSIZE
 *    UVPT      ---->  +------------------------------+ 0xef400000
 *                     |          RO PAGES            | R-/R-  PTSIZE
 *    UPAGES    ---->  +------------------------------+ 0xef000000
 *                     |           RO ENVS            | R-/R-  PTSIZE
 * UTOP,UENVS ------>  +------------------------------+ 0xeec00000
 * UXSTACKTOP -/       |     User Exception Stack     | RW/RW  PGSIZE
 *                     +------------------------------+ 0xeebff000
 *                     |       Empty Memory (*)       | --/--  PGSIZE
 *    USTACKTOP  --->  +------------------------------+ 0xeebfe000
 *                     |      Normal User Stack       | RW/RW  PGSIZE
 *                     +------------------------------+ 0xeebfd000
 *                     |                              |
 *                     |                              |
 *                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 *                     .                              .
 *                     .                              .
 *                     .                              .
 *                     |~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|
 *                     |     Program Data & Heap      |
 *    UTEXT -------->  +------------------------------+ 0x00800000
 *    PFTEMP ------->  |       Empty Memory (*)       |        PTSIZE
 *                     |                              |
 *    UTEMP -------->  +------------------------------+ 0x00400000      --+
 *                     |       Empty Memory (*)       |                   |
 *                     | - - - - - - - - - - - - - - -|                   |
 *                     |  User STAB Data (optional)   |                 PTSIZE
 *    USTABDATA ---->  +------------------------------+ 0x00200000        |
 *                     |       Empty Memory (*)       |                   |
 *    0 ------------>  +------------------------------+                 --+
 *
 * (*) Note: The kernel ensures that "Invalid Memory" is *never* mapped.
 *     "Empty Memory" is normally unmapped, but user programs may map pages
 *     there if desired.  JOS user programs map pages temporarily at UTEMP.
 */

```


首先是执行 i386_detect_memory() 探测内存，分别调用了3次读取CMOS寄存器的函数：
```
	basemem = nvram_read(NVRAM_BASELO);
	extmem = nvram_read(NVRAM_EXTLO);
	ext16mem = nvram_read(NVRAM_EXT16LO) * 64;
```

追踪到  kclock.h 注释

```
#define	MC_NVRAM_START	0xe	/* start of NVRAM: offset 14 */

...

/* NVRAM bytes 7 & 8: base memory size */
#define NVRAM_BASELO	(MC_NVRAM_START + 7)	/* low byte; RTC off. 0x15 */
#define NVRAM_BASEHI	(MC_NVRAM_START + 8)	/* high byte; RTC off. 0x16 */

/* NVRAM bytes 9 & 10: extended memory size (between 1MB and 16MB) */
#define NVRAM_EXTLO	(MC_NVRAM_START + 9)	/* low byte; RTC off. 0x17 */
#define NVRAM_EXTHI	(MC_NVRAM_START + 10)	/* high byte; RTC off. 0x18 */

/* NVRAM bytes 38 and 39: extended memory size (between 16MB and 4G) */
#define NVRAM_EXT16LO	(MC_NVRAM_START + 38)	/* low byte; RTC off. 0x34 */
#define NVRAM_EXT16HI	(MC_NVRAM_START + 39)	/* high byte; RTC off. 0x35 */
```

可以看到内存探测可以分为三部分

- base memory 0 ~ 1MB
- extended memory 1MB ~ 16MB
- extended memory 16MB ~ 4G


内存的初始化可以完成一部分，引导用的内存页分配函数以及准备为每一个页准备一个 PageInfo 结构体进行管理。

``` C
boot_alloc():
    // before the page_init(), it's a temple allocater .
    result = nextfree;
    nextfree = ROUNDUP(nextfree + n, PGSIZE);
    if((uint32_t )nextfree - KERNBASE >= 0xfffffff)
            panic("out of ranges");
    return result;

mem_init():
    //为每一个4K页面准备一个结构体进行管理。
    pages = (struct PageInfo *)boot_alloc(npages * sizeof(struct PageInfo));
    memset(pages, 0, npages * sizeof(struct PageInfo));
```


根据 page_init() 注释，内存未使用情况应该如下图（白色部分）：

![mem-layout.png](/images/operating-system/6.828/lab2/mem-layout.png)

在 boot_alloc() 函数中，内存是从 **end** 这个位置开始分配的：

```
extern char end[];
nextfree = ROUNDUP((char *) end, PGSIZE);
```

**end** 是由链接器自动产生的符号，指向内核的 .bss 段的结尾，所以 boot_alloc() 分配的内存都是从内核elf的bss段后开始分配的。


以下内存不可以被分配（灰色部分）：

1. 实模式下的 IDT 和 BIOS 数据结构 (page 0)
2. IO hole （IOPHYSMEM ~ EXTPHYSMEM）
3. 之前通过 boot_alloc() 分配掉用于存储页目录和页管理结构体的内存。

于是在初始化的时候，就将不可再分配的页的引用次数计为1。代码中出现的 basemem 实际上指 0 ~ 640K (从CMOS中读取出来的值)，而不是指广义上的 0 ~ 1MB。

``` C
void
page_init(void)
{
    size_t i;
    size_t IOhole_pages = (EXTPHYSMEM - IOPHYSMEM) / PGSIZE;
    size_t allocated_pages = ((uint32_t)boot_alloc(0) - KERNBASE) / PGSIZE;
    for (i = 0; i < npages; i++) {
		if (i == 0)
			pages[i].pp_ref = 1;
		else if (i >= npages_basemem &&
				i < npages_basemem + IOhole_pages + allocated_pages) {
			pages[i].pp_ref = 1;
		} else {
			pages[i].pp_ref = 0;
			pages[i].pp_link = page_free_list;
			page_free_list = &pages[i];
		}
    }
}
```

页的分配和回收实现为单链表插入与删除。

``` C
struct PageInfo *
page_alloc(int alloc_flags)
{
    if (page_free_list == NULL)
        return NULL;

    struct PageInfo *newpage = page_free_list;
    page_free_list = page_free_list->pp_link;
    newpage->pp_link = NULL;

    if (alloc_flags & ALLOC_ZERO)
    	memset(page2kva(newpage), 0, PGSIZE);

    return newpage;
}

void
page_free(struct PageInfo *pp)
{
	if(pp->pp_link != NULL || pp->pp_ref != 0)
		panic("cann't free or it's free");
	else {
		pp->pp_link = page_free_list;
		page_free_list = pp;
	}
}
```


这部分做到 `check_page_free_list(1);`


```
$ make qemu-nox
...
6828 decimal is 15254 octal!
Physical memory: 131072K available, base = 640K, extended = 130432K
check_page_free_list() succeeded!
check_page_alloc() succeeded!
```





## 练习2

了解x86保护机制和段页翻译.

参考资料：

> - [Intel 80386 Reference Manual: chapters 5 and 6](https://pdos.csail.mit.edu/6.828/2017/readings/i386/toc.htm)
> - [Intel® 64 and IA-32 Architectures Software Developer’s Manual](https://pdos.csail.mit.edu/6.828/2018/readings/ia32/IA32-3A.pdf)

保护机制的产生实际上是为了探测和找到程序中可能出现的bug。


## 练习3

### 使用QEMU和GDB查看内存

进入保护模式后可以通过

    ctrl+a c
进入QEMU的监视器，查看内存情况。

    (QEMU) xp phisical address
查看物理地址信息

    (gdb) x/x virtual address
查看虚拟地址信息


## 练习4

JOS中定义了两种针对于不同地址的数据类型,`uintptr_t`代表虚拟地址,`physaddr_t`表示物理地址,宏定义都为`uint32_t`。解引用(dereference)都要通过段页机制实现，所以如果对物理地址进行解引用，会有非预期的结果。

**Question**

- Assuming that the following JOS kernel code is correct, what type should variable x have, uintptr_t or physaddr_t?
    ``` C
        mystery_t x;
        char* value = return_a_pointer();
        *value = 10;
        x = (mystery_t) value;
    ```

根据上述对类型的描述，因为有解引用操作，x的类型应该为`uintptr_t`。

### 引用计数

每一个 struct PageInfo 对应一个4KB物理页，对应一个页，如果计数到达了 0，说明这块内存将不再使用，一般来说，引用计数的值应该等于在 UTOP 以下的页表中出现的次数。因为高于 UTOP 的页表一般被内核所使用，不应该释放。

### Page Table Management

因为此时内核已经开启了页机制，所以不可能绕过这个机制，所使用的地址必须映射在页目录中的地址。

**PADDR(va)** : virtual address - KERNELBASE， va 如果小于 KERNELBASE 则 panic。

**KADDR(pa)** : physical address + KERNELBASE，pa 如果超出实际内存大小 则 panic。

**page2kva(struct PageInfo *)** : struct PageInfo pointer -> virtual address


``` C

pte_t *
pgdir_walk(pde_t *pgdir, const void *va, int create)
{
    size_t pgdir_index = PDX(va);
    size_t page_offset = PTX(va);
    pde_t dir_entry = pgdir[pgdir_index];

	if (!(dir_entry & PTE_P)) {
        // get page table address which a pointer point to .
        if(create){
            struct PageInfo *allocated_page = page_alloc(ALLOC_ZERO);
		   	if(allocated_page == NULL) return NULL;
			// increment reference count
            allocated_page->pp_ref++;
            // the page physical address
			physaddr_t pg_phyaddr = page2pa(allocated_page) ;
			// fill page table entry
            pgdir[pgdir_index] = pg_phyaddr | PTE_P | PTE_W | PTE_U;
		} else {
           return NULL;
		}
    }

	// point to a page table
    pte_t *pt_base = KADDR(PTE_ADDR(pgdir[pgdir_index]));
    return &(pt_base[page_offset]);
}

static void
boot_map_region(pde_t *pgdir, uintptr_t va,
                  size_t size, physaddr_t pa, int perm)
{
    pte_t *pte;
	// 'size' is a multiple of PGSIZE.
    size_t page_num = size / PGSIZE;
    uint32_t i;

    for(i = 0; i < page_num; i++)
    {
        pte = pgdir_walk(pgdir, (void *)va, true);
        if (pte == NULL) return;
		*pte = pa | perm | PTE_P;
        pa += PGSIZE;
        va += PGSIZE;
    }
}

struct PageInfo *
page_lookup(pde_t *pgdir, void *va, pte_t **pte_store)
{
    struct PageInfo *ret = NULL;
    pte_t *pte = pgdir_walk(pgdir, va, false);
    if(pte == NULL)
    	return NULL;
    if((*pte & PTE_P) == 0)
    	return NULL;

    ret = pa2page(PTE_ADDR(*pte));
    if(pte_store != NULL)
    {
    	*pte_store = pte;
    }
    return ret;
}

void
page_remove(pde_t *pgdir, void *va)
{
	// get page table entry and PageInfo.
	pte_t *pte = NULL;
	struct PageInfo* upage = page_lookup(pgdir, va, &pte);

	if(upage == NULL) return;

	// decrement reference count
    // freeing it if there are no more refs
	page_decref(upage);

	// flush page-translation cache about this page
	tlb_invalidate(pgdir, va);

	// clean pte
	*pte = 0 ;
}

int
page_insert(pde_t *pgdir, struct PageInfo *pp, void *va, int perm)
{
	// modify pde
	pte_t *entry = pgdir_walk(pgdir, va, true);
	if (entry == NULL)
		return -E_NO_MEM;

	// page colides
	pp->pp_ref++;
	if (*entry & PTE_P) {
		// decrement and free
		// page invalidate in page_remove()
		page_remove(pgdir, va);
	}

	// modify pte
	*entry = page2pa(pp) | perm | PTE_P;

	return 0;
}
```

Intel TLB 无效技术有两种方法：

- 向CR3寄存器写入值时，所有处理器自动刷新相对于非全局TLB表项
- 在Pentium Pro及以后的处理器中，invlpg 指令能使映射指定线性地址的单个TLB表项无效


练习4到此完成。


## 练习5

`Kernal Address Space`


JOS把线性地址分为两部分，低地址的用户环境(User enviroment - Processes)和高地址的内核，用户部分在Lab3中加载使用。内存分给内核从`KERNBASE`开始到内存结束共大约256MB。


### 权限和错误隔离

为了防止用户代码的bug覆盖写内核数据或者代码导致崩溃，使用权限bit位限制用户代码的权限，使其只能访问其内存空间。对于用户级代码来说大于ULIM的是不允许访问的，属于内核的空间。内存地址[UTOP,ULIM) 对于User和Kernal都是只读的，用于内核暴露一部分只读数据结构给用户。

完成 mem_init() 剩余的代码：

``` C
// Map 'pages' read-only by the user at linear address UPAGES
boot_map_region(kern_pgdir, UPAGES, PTSIZE, PADDR(pages), PTE_U | PTE_P);

// Use the physical memory that 'bootstack' refers to as the kernel
boot_map_region(kern_pgdir, (KSTACKTOP-KSTKSIZE), KSTKSIZE, PADDR(bootstack), PTE_W | PTE_P);

// Map all of physical memory at KERNBASE.
boot_map_region(kern_pgdir, KERNBASE, 0xFFFFFFF, 0, PTE_W | PTE_P);

```

通过剩下几个测试

```
$ make qemu-nox
...
6828 decimal is 15254 octal!
Physical memory: 131072K available, base = 640K, extended = 130432K
check_page_free_list() succeeded!
check_page_alloc() succeeded!
check_page() succeeded!
check_kern_pgdir() succeeded!
check_page_free_list() succeeded!
check_page_installed_pgdir() succeeded!
```

然后将新填写的页目录地址重新加载到CR3寄存器内，在开启剩余一些CR0寄存器位。
```
lcr3(PADDR(kern_pgdir));
cr0 = rcr0();
cr0 |= CR0_PE|CR0_PG|CR0_AM|CR0_WP|CR0_NE|CR0_MP;
cr0 &= ~(CR0_TS|CR0_EM);
lcr0(cr0);
```

|PE|

---

### Question



- Q2:What entries (rows) in the page directory have been filled in at this point? What addresses do they map and where do they point?

![virtualaddress.png]( /images/operating-system/6.828/lab2/virtualaddress.jpg)


- Q3:We have placed the kernel and user environment in the same address space. Why will user programs not be able to read or write the kernel's memory? What specific mechanisms protect the kernel memory?

    与页目录和页表中的 User/supervisor flag 和 Read/write flag 有关

    > “ When the processor is in user mode, it can write only to usermode pages that are read/write accessible. User-mode pages which are read/write or read-only are readable; supervisor-mode pages are neither readable nor writable from user mode. ”

    > [Intel® 64 and IA-32 Architectures Software Developer’s Manual](https://pdos.csail.mit.edu/6.828/2018/readings/ia32/IA32-3A.pdf)

    >**4.11.3** Page Type

    可以看到 jos 只有 UPAGES 以上 PTSIZE 的内存设置了 PTE_U，除了这个部分对于用户级别可以读，其他的部分都是不可读或写的。

- Q5:How much space overhead is there for managing memory, if we actually had the maximum amount of physical memory? How is this overhead broken down?

    2G

- Q6: Revisit the page table setup in kern/entry.S and kern/entrypgdir.c. Immediately after we turn on paging, EIP is still a low number (a little over 1MB). At what point do we transition to running at an EIP above KERNBASE? What makes it possible for us to continue executing at a low EIP between when we enable paging and when we begin running at an EIP above KERNBASE? Why is this transition necessary?


        mov     $relocated, %eax
        jmp     *%eax

    jmp 完后就到了高地址，在临时的内核页目录中，同时将虚拟地址 [0 ~ 4MB) 和 [KERNELBASE ~ KERNELBASE+4MB) 映射了物理内存 [0 ~ 4MB)，所以即使 PE 置位后仍然能正常执行。在 lab2 中重新加载了新映射的 kern_pgdir，里面并没有映射 [0 ~ 4MB) 这一部分，继续在低地址执行但是页表里面并没有相应的项。


答案参考: https://github.com/Clann24/jos/tree/master/lab2

## Challenge 2

---

这个给JOS增加一个调试器，很有必要做一下，方便之后的学习。

### 辅助函数 str2ptr()
JOS中没有包含标准库，需要自己写一下字符串到整形的转换。
``` C
pde_t *
str2ptr(char *str)
{
    pde_t ptr;
    int temp, i;
    size_t length;

    length = strlen(str) ;
    ptr = 0;
    for (i = 2; str[i] != 0; i++) {

        if(str[i] <= '9')
            temp = str[i] - '0';
        else
            temp = str[i] - 'a' + 10;
        ptr += temp * ( 1 << (length - i - 1) * 4 );
    }
    return (pde_t *)ptr;
}
```


### mon_mapinfo()

``` C
int
mon_mapinfo(int argc, char **argv, struct Trapframe *tf)
{
    extern pde_t *kern_pgdir;
    pde_t *pg_pa, *pg_va, size, iter;
    extern pte_t * pgdir_walk(pde_t *,const void *, int);


    if (argc < 3) {
        cprintf("too few argument  \n");
        return 0;
    }

    if (argv[1][0] == '0' && argv[1][1] == 'x') {       /* show address */

        /*initialize some variables*/
        size = str2ptr(argv[2]) - str2ptr(argv[1]);
        pg_va = str2ptr(argv[1]);

        /* use pgdir_walk function to get page entry */
        for (iter = (pde_t)pg_va; iter <= (pde_t)str2ptr(argv[2]); iter += PGSIZE) {

            pg_pa = pgdir_walk(kern_pgdir, (void *)iter, false);

            if (pg_pa == (void *)0)
                cprintf("0x%x: None\n", iter);
            else
                cprintf("0x%x: %x\n", iter, *pg_pa & ~0xFFF);

        }
    } else if (strcmp("set", argv[1]) == 0) {       /* set flag to Page Entry */
        pte_t flag;

        pg_va = str2ptr(argv[2]);
        pg_pa = pgdir_walk(kern_pgdir, (void *)pg_va, false);
        if (pg_pa == (void *)0) {
            cprintf("Error: Unallocated page");
            return 0;
        }
        else {
            flag = (pte_t) str2ptr(argv[3]);

            cprintf("set physical address %x: flag = %x ->", *pg_pa & ~0xFFF, *pg_pa);

            flag &= 0xFFF;          /* promise that the flag cann't affect the address */
            *pg_pa &= ~0xFFF;
            *pg_pa |=  flag;

            cprintf(" %x\n", *pg_pa & 0xFFF);
        }

    } else {
        cprintf("Usage error: showmapings ");
        cprintf("smp 0xff00ff00 0xff00ff00\n");
        cprintf("smp set 0xff00ff00 0x1\n");
    }
    return 0;
}

```

### show

    K> smp 0xf0000000 0xf01000000
    0xf0000000: 0
    0xf0001000: 1000
    0xf0002000: 2000
    0xf0003000: 3000
    0xf0004000: 4000
    0xf0005000: 5000
    0xf0006000: 6000
    0xf0007000: 7000
    0xf0008000: 8000
    0xf0009000: 9000
    ...
    0xf00fe000: fe000
    0xf00ff000: ff000
    0xf0100000: 100000
正好说明虚拟地址__KERNBASE~0xFFFFFFFF__被映射到了__0x00000000~0x0FFFFFFF__
### set

    K> smp set 0xf0000000 0x1
    set physical address 0: flag = 3 -> 1