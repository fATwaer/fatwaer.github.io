---
title: '6-828-操作系统工程-Lab5-File system, Spawn and Shell'
categories:
  - sys
date: 2018-05-20 18:37:16
tags:
  - OS
---

这个实验主要是实现`spawn`库函数用来读取并运行可执行文件，然后扩充操作系统的内核和库
，使得足以在控制台上运行`shell`。实现这些特性需要一个文件系统，而接下来就会介绍一个简单的可读写的文件系统。


# 准备

`git`

```
    $ find . -name "*.swp" | xargs rm
    $ git add .
    $ git commit -m "lab4 done"
    $ git pull
    $ git merge lab4
        Auto-merging kern/trap.c
        CONFLICT (content): Merge conflict in kern/trap.c
        Auto-merging kern/syscall.c
        Auto-merging kern/init.c
        CONFLICT (content): Merge conflict in kern/init.c
        Auto-merging kern/env.c
        CONFLICT (content): Merge conflict in kern/env.c
        Auto-merging inc/lib.h
        Automatic merge failed; fix conflicts and then commit the result.
```
解决conflict，并且确认pingpong, primes, 和forktree这三个用户程序可以正常运行。



---

# 文件系统

这里将使用一个比实际更简单的文件系统，但这足以提供一些基本的特点：创建，读取，写入和删在除文件在一个具有层级结构的文件结构。

到目前为止已经完成了单用户操作系统，能够提供足够的保护去捕获bug但是不会阻止来自其他可疑用户的操作。新的文件系统暂时不支持硬链接(hard link),符号链接(symbolic links),时间戳(time stamps)或者特殊设备文件(device files).

磁盘文件系统的结构：大多数UNIX文件系统将磁盘空间分成两类，`inode`区域和`data`区域。UNIX文件系统给每一个文件都赋予一个`inode`值，文件的`inode`保持这个文件的临界元数据(critical meta-data)例如文件的`stat`属性和指向数据块的指针。数据区域被分成了更大的`data block`，文件系统将文件数据和目录元数据存储在其中。目录的入口包含了文件名和指向`inode`的指针。一个文件能被硬链接只有多个文件目录入口引用了这个文件的`inode`。因为这里不支持硬链接，所以可以做一个方便的转化：完全不使用`inode`而简单地存储所有的文件的元数据在目录入口来描述每个文件。

文件和目录逻辑上组成了一连串的数据块(data block)，可能被散布在磁盘也有可能在一个环境的虚拟地址空间所映射的物理内存上。文件系统隐藏了这些数据块的存放细节，为在一个绝对的文件偏移提供了接口方便读写字节流。文件系统对目录的修改表现为创建文件或者删除文件。这里的文件系统云溪用户环境读取目录的元数据，这意味着用户环境能自己扫描文件目录而不是依赖于一个二外的调用。这样做也有缺点，现代大多是UNIX的变体都不推荐使用它，这使得应用程序依赖于文件目录的格式，这让在没有改变或者编译应用程序的情况下很难改变文件系统内部存放。

扇区和块
大多数磁盘不支持字节粒度的读写而是通过读写一个扇区单元。JOS中，每个区块都是512字节。文件系统实际上在块的单元分配和使用磁盘存储。注意：sector取决于磁盘硬件，然而block的大小是操作系统使用磁盘的一个大小。所以文件系统的块大小必须是块的整数倍。

![disk.png]( /images/operating-system/6.828/lab5/disk.png)

superblock
文件系统通常保留一个确定位置(最前面或者最末尾)的磁盘块来保存描述文件系统特性的元数据。任何元数据被要求找到根目录，文件系统上次被增减的时间，上次检查错误的时间等等。在这里的文件系统中将会有一个确定的superblock，它将总是在block1的位置，被定义在`stuct Super`。Block0通常被用来保存boot loaders和分区表(partition tables)。大多是实际的文件系统维护多个superblock，散布在disk中，所以其中的一个块发生了损毁或者介质错误，其他的superbloock仍能被找到。

---

文件元数据

在这个文件系统中，meta-data的存放在`stuct File`中定义了。其中包含了文件名，文件大小，文件类型(普通文件或者目录)，以及一个指针指向下一个包含文件的块，因为不支持`inode`，所以这些元数据被存储在了目录入口，为了简化，将会直用File这一个结构体去表示即在磁盘和内存的元数据。

结构体中`f_direct`数据包含了文件空间的前十个块，称之为文件的直接块。从小到大共40KB，这意味着这10个块号可以被这个File结构体直接引用。对于更大的文件，分配一个额外的磁盘块，被称作文件的间接块(indirect block)，能够保存1024个额外的块号。所以，文件系统因此能允许文件最大到1034个块已经大于了4M，当然实际的文件系统通常支持多个`double-`和`triple` `indrect block`。

目录 vs. 普通文件
文件系统中的`File`结构体既能表示一个普通文件也能表示一个目录。它们的区别在于结构体的`。type`，两者的管理方法基本相同，除了目录文件不会解析普通文件的数据块，但是他会解析文件对目录文件的描述和子目录。

![file.png]( /images/operating-system/6.828/lab5/file.png)

superblock包含了一个`File`结构体，`Super`结构体中的`root`域保存了系统根目录的元数据。目录文件的内容是一系列`File`结构体，所有在根目录下的子目录也许会有多个`File`结构体用来表示次次级目录。

x86使用EFLAGS寄存器中的`IOPL`位来决定在保护模式下的代码是否被允许执行例如`in`或者`out`这样的指令。因为所有的在x86 IO空间的IDE(Integrated Drive Electronics)磁盘寄存器都需要访问，而不是被映射到内存。给予文件系统的IO权限是为了能偶个访问所有的寄存器，同时是一种办法来控制其他用户环境的代码是否有权限来访问I/O空间。

---
# 练习1
>
---

``` C
    if (type == ENV_TYPE_FS)
        env->env_tf.tf_eflags |= FL_IOPL_3;
```

一开始的想法是使用privilige 0，也就是FL_IOPL_0，但是出错了。

> Indicates the I/O privilege
> level (IOPL) of the currently running program or task. The CPL of the
> currently running program or task must be less than or equal to the IOPL to
> access the I/O address space. This field can only be modified by the POPF
> and IRET instructions when operating at a CPL of 0.

解释是当前用户环境的CPL(current privilege level)必须小于或等于IOPL等级才行。普通用户环境默认被初始化为0，而CPL是3，所以正常的进程是不能直接执行IO操作的。在后面的测试`spawnfaultio`测试中有测试。如果需要文件系统能进行IO，则将IOPL值置为3即可。


>Q1:Do you have to do anything else to ensure that this I/O privilege setting is saved and restored properly when you subsequently switch from one environment to another? Why?

前面的实验中有想过，每当一个环境开始运行的时候，也就是调用`env_run`函数的适合都会执行`iret`以恢复寄存器状态。

---

块高速缓存

在这个文件系统中，将会在处理器的虚拟内存系统中实现一个简单的缓冲区，代码在`fs/bc.c`
文件系统将会限制可操作的磁盘大小是3G或者更少，保留一个够大的3GB区域在文件系统的内存空间，从0x10000000 (DISKMAP) 到 0xD0000000 (DISKMAP+DISKMAX)，作为一个映射在内存的磁盘版本。例如，block0被映射在0x1000000，block1映射在0x10001000等等。`diskaddr`函数实现了从块号到虚拟内存的转换，并且做了一些正常的检测。

文件系统拥有其自己的虚拟内存空间独立于其他所有的用户环境，并且文件系统的仅需要做的一件事就是实现文件访问，有理由去保留大多数文件系统的内存空间。

当然，读取整个磁盘到内存中将会花费相当长的时间，所以实现一种`demand paging`仅仅分配那些需要相应块号对应的页，以可信的方式引发一个页错误，再分配。通过这种方式，能假定整个磁盘是在内存中。

---
# 练习2
>实现fs/bc.c中的bc_pgfault函数和flush_block函数
>bc_pgfault是一个页错误处理handler，就像之前的cow fork，希望从磁盘读取页会产生页错误。
>  1.addr 也许不是与block边界对齐的。
>  2.ide_read 是在扇区操作不是块。
>flush_block 函数如果有必要的话需要写一个块到磁盘中，如果没有block cache或者不是"dirty"状态(5.2.4.3),fluash_block什么也不会做。

`ide_write`
``` C
int
ide_write(uint32_t secno, const void *src, size_t nsecs)
{
    int r;

    assert(nsecs <= 256);

    ide_wait_ready(0);

    outb(0x1F2, nsecs); //sector count
    outb(0x1F3, secno & 0xFF); //sector number
    outb(0x1F4, (secno >> 8) & 0xFF); //clinder low
    outb(0x1F5, (secno >> 16) & 0xFF); //clinder high
    outb(0x1F6, 0xE0 | ((diskno&1)<<4) | ((secno>>24)&0x0F)); //select driver 1
    outb(0x1F7, 0x30);  // CMD 0x30 means write sector

    for (; nsecs > 0; nsecs--, src += SECTSIZE) {
        if ((r = ide_wait_ready(1)) < 0)
            return r;
        outsl(0x1F0, src, SECTSIZE/4);//data register
    }

    return 0;
}

```
这个函数和ide_read基本相同，往磁盘寄存器内读写数据，设置读写计数器，读写的扇区号，柱面等等，然后通过一个for循环读取写入数据。CPU之前已经将相应的内存页在UVPT中标记为了`dirty`状态，也就是页重写标志位，当把内容读到内存中去的适合发生页错误，引发陷入从而分配一个新的物理页，并且写入数据。JOS用bc_pgfault作为handler处理这种页错误，代码如下。

``` C
# bc_pgfault
    // Allocate a page in the disk map region, read the contents
    // of the block from the disk into that page.
    // Hint: first round addr to page boundary. fs/ide.c has code to read
    // the disk.
    //
    // LAB 5: you code here:
    addr = (void *)ROUNDDOWN((uint32_t)addr, PGSIZE);
    if ((r = sys_page_alloc(0, addr, PTE_P|PTE_U|PTE_W)) < 0)
        panic("in sys_page_alloc, %e", r);
    if ((r = ide_read(blockno * BLKSECTS, addr, BLKSECTS) < 0))
        panic("in ide_read , %e", r);
```

---
flush_content的主要作用就是把数据写回到磁盘中去，然后清楚PTE_D页面重写标记为，代码如下：

``` C
void
flush_block(void *addr)
{
    uint32_t blockno = ((uint32_t)addr - DISKMAP) / BLKSIZE;
    int r;

    if (addr < (void*)DISKMAP || addr >= (void*)(DISKMAP + DISKSIZE))
        panic("flush_block of bad va %08x", addr);

    // LAB 5: Your code here.
    addr = (void *)ROUNDDOWN((uint32_t)addr, PGSIZE);
    if (!va_is_mapped(addr))
        return;
    if (!va_is_dirty(addr))
        return;
    if ((r = ide_write(blockno*BLKSECTS, addr, BLKSECTS)) < 0)
        panic("ide_write fault : %e", r);
    if ((r = sys_page_map(0, addr, 0, addr, uvpt[PGNUM(addr)] & PTE_SYSCALL)) < 0)
        panic("map fault : %e", r);

    //panic("flush_block not implemented");
}
```

`fs_init`函数是一个范例使用block cache，初始化后super存储指向磁盘映射范围的指针。在此之后，就能从super结构体读取数据就好像是从磁盘读取一样。

>Challenge:淘汰机制.

块位图(Block Bitmap)
在`fs_init`设置好了`bitmap`指针后，可以将`bitmap`看作一个比特数组，其中一位对应着在磁盘中的一个块。例如，`block_is_free`就是检测一个跟定的块是否在`bitmap`中被标记。

---

# 练习3

>使用`free_block`作为一个范例去实现`alloc_block`函数，如果能在位图里找到空闲的磁盘块，标记其已经被使用，并且返回块号。当分配好了块，需要马上改变磁盘中的的位图块，使用`flush_block`函数，使得文件系统在内存的内容和在硬盘中内容一致。


```
int
alloc_block(void)
{
    // The bitmap consists of one or more blocks.  A single bitmap block
    // contains the in-use bits for BLKBITSIZE blocks.  There are
    // super->s_nblocks blocks in the disk altogether.

    // LAB 5: Your code here.
    //panic("alloc_block not implemented");
    int i;

    for (i = 2; i < super->s_nblocks; i++)
        if (block_is_free(i)) {
            bitmap[i/32] ^= 1<<(i%32);
            flush_block(bitmap);
            return i;
        }
    return -E_NO_DISK;
}
```

块的位图将每一个整形的bit最为一个块的使用标志，3G区域共3GB/4KB个块，所对应的位图共96KB。PS：位图中置0表示已经使用。


---

# 文件操作
在文件fs/fs.c中提供了一些函数管理`File`结构体的函数，解释结构体，扫描管理目录文件的入口，从根目录遍历整个文件系统。

fs_init()：找到JOS的磁盘，全局变量`super` block指向第1号扇区在内存中的映射(第0号扇区是bootloader)，`bitmap`指向第2号扇区所对应在内存中的映射。

static int
file_block_walk(struct File \*f, uint32_t filebno, uint32_t \*\*ppdiskbno, bool alloc)
找到文件结构体中的文件块号对应的全局文件块号，将块号存在*ppdiskbno中，如果没有根据`alloc`的值判断是否分配。

int
file_get_block(struct File \*f, uint32_t filebno, char \*\*blk)
获得一个文件结构体文件块号所对应在内存中的映射，把结果存在*blk中。

static int
dir_lookup(struct File \*dir, const char \*name, struct File \*\*file)
通过`file_get_block`获得这个目录文件结构体所在的块，再用一个文件一个文件结构体的对照文件名，直到相等再把`file`指向这个找到的文件。

static int
dir_alloc_file(struct File \*dir, struct File \*\*file)
首先现在目录本身的结构体中寻找可以用的空文件结构体，如果找不到则新分配一个块并且目录文件大小也会增加，`file`指向这个空闲的文件结构体。

walk_path()：和HOMEWORK中做的命令解释器很像，从根目录开始迭代，例如`/usr/bin`就会被一步一步地解析为 super->usr->bin，usr和bin分别作为目录和文件返回。

file_create(const char \*path, struct File \*\*pf)
在`path`目录下创建一个文件，通过指针返回一个文件，并且会把文件写回磁盘。

file_open()
file_read()
file_write()
都是基本的文件操作，不过要注意的是，文件的写操作只是写在了磁盘所映射的内存，没有存回磁盘，所以应该需要flush操作。

file_free_block()：在块的位图上释放文件块

file_truncate_blocks()：缩小文件大小，释放掉保持的磁盘块，但是不会修改结构体中的f->f_size的值。
file_set_size()：设置文件的大小，并且写回磁盘。

file_flush()把一个单独的文件写回磁盘而fs_sync()将整个内存映射都写回磁盘。


# 练习4
实现file_block_walk和file_get_block函数。
file_block_walk通过一个在文件内的偏移，映射结构体所直接指向的块或者间接指向的块。
file_get_block更及进一步地映射实际的磁盘块，如果有必要的话分配一个新磁盘块。
代码如下：
## file_block_walk()

``` C
static int
file_block_walk(struct File *f, uint32_t filebno, uint32_t **ppdiskbno, bool alloc)
{
    // LAB 5: Your code here.
    //panic("file_block_walk not implemented");
    int r;

    //  cprintf("filebno %d\n", filebno);
    if (filebno > NDIRECT + NINDIRECT)
        return -E_INVAL;
    if (filebno < NDIRECT) {
        if (ppdiskbno)
            *ppdiskbno = f->f_direct + filebno;
        return 0;
    }
    //cprintf("indirect: %08x logic: %d\n", f->f_indirect, !f->f_indirect);
    if (!f->f_indirect) {
        if (alloc) {
            if ((r = alloc_block()) < 0)
                return r;
            memset(diskaddr(r), 0, BLKSIZE);
            f->f_indirect = r;
            flush_block(diskaddr(r));
        }
        else
            return -E_NOT_FOUND;
    }
    *ppdiskbno = (uint32_t *)diskaddr(f->f_indirect) + filebno - NDIRECT;
    //cprintf("fileno : %d -> diskno: %x -> %x\n", filebno, *ppdiskbno, **ppdiskbno);
    return 0;

}
```
做的后面踩了前面的坑，`diskaddr`的返回类型需要坐下强制类型转换，`void *`指针类型p与`uint32_t`的n相加等于`p + n * 1`，而这里需要的是整形指针相加的结果`p + n * 4`。
## file_get_block()
``` C
int
file_get_block(struct File *f, uint32_t filebno, char **blk)
{
    // LAB 5: Your code here.
    //panic("file_get_block not implemented");
    uint32_t *bno;
    int r;

    if ((r = file_block_walk(f, filebno, &bno, 1)) < 0)
        return r;

    // allocate a block if the block number is zero
    // meaning that it hasn't refered to any block by now.
    if (*bno == 0) {
        if ((r = alloc_block()) < 0)
            return r;
        *bno = r;
        memset(diskaddr(r), 0, BLKSIZE);
        flush_block(diskaddr(r));
    }
    // *bno is the number of blocks
    *blk = diskaddr(*bno);
    return 0;
}
```


做到这里可以发现，当往文件写内容的适合，实际是先写入内存的缓冲区的，只有最后执行了flush操作，才会真正把内容保存到磁盘中去。

---


# 文件系统接口
现在有必要为文件系统自己提供一些功能/接口，必须文件系统能够被其他用户环境使用。因为其他环境不能直接调用文件系统环境中的函数，所以通过远程程序调用RPC(remote procedure call)能访问文件系统的接口。
```
      Regular env           FS env
   +---------------+   +---------------+
   |      read     |   |   file_read   |
   |   (lib/fd.c)  |   |   (fs/fs.c)   |
...|.......|.......|...|.......^.......|...............
   |       v       |   |       |       | RPC mechanism
   |  devfile_read |   |  serve_read   |
   |  (lib/file.c) |   |  (fs/serv.c)  |
   |       |       |   |       ^       |
   |       v       |   |       |       |
   |     fsipc     |   |     serve     |
   |  (lib/file.c) |   |  (fs/serv.c)  |
   |       |       |   |       ^       |
   |       v       |   |       |       |
   |   ipc_send    |   |   ipc_recv    |
   |       |       |   |       ^       |
   +-------|-------+   +-------|-------+
           |                   |
           +-------------------+
```

在点线之下是从普通用户环境发送到文件系统环境的一个读请求。开始的时候，`read`工作在任何文件描述符上，并且分发到合适的设备读函数，这里是使用的`devfile_read`函数，当然还有其他各种的设备类型比如管道。`devfile_read`实现了读对磁盘上文件的操作，这个函数和其他`devfile_*`函数是实现了客户端这边的文件系统的操作，并且所有的工作几乎相同，绑定参数到request结构体，并且调用`fsipc`发送IPC请求和解析返回的值。`fsipc`函数完成了发送请求到服务端和接收回复的细节。

文件系统服务端代码在fs/serv.c中，服务端循环`serve`函数，接收来自IPC的请求，分发请求到合适的handler函数，并且将访问的结果通过IPC返回。在读操作的例子中，`serve`分发请求到`serve_read`，这个函数将会关注IPC的读请求细节，例如解包request结构体后调用`file_read`去执行文件读操作。

回顾JOS的IPC机制，让一个环境发送一个32位的数字，并且有选择性的分享页。为了从客户端到服务端发送一个请求，这里使用32位的数字去指定request类型，并且存储request参数到`union Fsipc`所在的共享页上去。在客户端，总是将共享页放在`fsipcbuf`处；在服务端，将即将到来的请求页映射在`fsreq`(0x0ffff000)处。

服务端也会通过IPC发送回复消息，将ipc参数中的32位值设置为相关函数的返回值。大多数RPC都会有它们自己的返回类型，`FSREQ_READ`和`FSREQ_STAT`总是返回数据，这两个函数将数据写到客户端所发送的request页上。但是不需要通过IPC发送这个页，因为客户端已经分享了这个物理页。当然，例如`FSREQ_OPEN`分享给客户端一个新的Fd页,将会很快的返回文件描述符指定的页。

# 练习5
实现`serve_read`
`serve_read`的艰苦工作已经被`file_read`实现了，它只需要位文件的读提供RPC的接口，可以参照`serve_set_size`函数。
``` C
int
serve_read(envid_t envid, union Fsipc *ipc)
{
    struct Fsreq_read *req = &ipc->read;
    struct Fsret_read *ret = &ipc->readRet;
    struct OpenFile *o;
    int r;
    char buf[PGSIZE];
    size_t read_count, remainder;

    if (debug)
        cprintf("serve_read %08x %08x %08x\n", envid, req->req_fileid, req->req_n);
    // Lab 5: Your code here:
    // same as before, find the file firstly.
    if ((r = openfile_lookup(envid, req->req_fileid, &o)) < 0)
        return r;

    if ((r = file_read(o->o_file, ret->ret_buf, req->req_n, o->o_fd->fd_offset)) < 0)
        return r;
    o->o_fd->fd_offset += r;
    //memcpy(ret, buf, PGSIZE);
    return r;
}

```
关于偏移的到结束的大小，这里不用再做判断了，已经`file_read`函数中实现了。


# 练习6
实现`serve_write`
``` C
static ssize_t
devfile_write(struct Fd *fd, const void *buf, size_t n)
{
    // Make an FSREQ_WRITE request to the file system server.  Be
    // careful: fsipcbuf.write.req_buf is only so large, but
    // remember that write is always allowed to write *fewer*
    // bytes than requested.
    // LAB 5: Your code here
    //panic("devfile_write not implemented");
    int r;

    fsipcbuf.write.req_fileid = fd->fd_file.id;
    fsipcbuf.write.req_n = n;

    memmove(fsipcbuf.write.req_buf, buf, n);
    if ((r = fsipc(FSREQ_WRITE, NULL)) < 0)
        return r;
    return r;
}
```

这两个实现比较简单，跟着指导做就好，但不能仅仅满足于函数天空，这些函数都是一层一层包装上去的，省去了背后的原理和操作，例如设置页位"dirty状态"，引发页错误分配映射，避免磁盘全部映射而占据大量内存空间。文件的读写操作都被简化了，在`testfile.c`源码中都是使用的`write`,`open`,`read`等被抽象的操作，而实际的过程比如`write`操作会被分发到`devfile_write`通过IPC发送写信号并且共享传递的页，文件系统进程收到写信号并将传递过来的页映射在一个固定的位置，找到文件描述符所指定的文件，然后将共享页buf中的内容复制到磁盘映射页上面，最后在关闭文件的时候flush进行保存；文件系统服务端这边处理完文件后，会把文件写操作的字节数返回做为操作成功的信号通过IPC返回给客户端，并且取消映射共享页。给人的直接感受就是，操作者通过`write`操作直接写入了文件中。


# 产生子进程
`spawn`操作创建一个新的环境，从文件系统中读取程序镜像运行此程序，父进程独立于子进程继续运行。`spwan`函数的操作就像UNIX中`fork`后立马在子进程执行`exec`。

# 练习7

`spwan`依赖于新的系统调用`sys_env_set_trapframe`来初始化新被创建的环境状态，完成这个函数后，尝试运行`user/spanhello`程序。


# 通过fork和spawn分享库状态
UNIX文件描述符是一个泛指的概念，其中包含了pipe,控制台I/O等。在JOS中，每一种设备类型都有一个对应的`struct Dev`，使用指针实现读写等操作。对于这些设备类型，`lib/fd.c`实现了像UNIX的文件描述符的接口，每一个Fd结构体指定它自己的设备类型，fd.c中的函数分发分发各自的操作到相应的Dev结构体中去。
fd.c为每一个应用程序维护文件描述符表在它们各自的内存空间，地址起始于`FDTABLE`。这片4KB的页很值得为最多32个文件描述符保留在内存空间，使得应用程序能立即打开。在任意时刻，一个指定的文件描述符表页当且仅当对应的文件描述符是在被使用的。每一个文件描述符在这片区域还拥有一个可选的`data page`在地址`FILEDATA`处，设备可以用来使用。

因为可能需要通过`fork`和`spawn`来分享文件描述符的状态，但是文件描述符的状态是保存在各自用户内存空间中的。现在，fork已经标记那些需要被复制的页为cow状态。这里需要不同的用户环境共享用户环境，与cow分配并复制不同，PTE_SHARE的标记意味着直接映射该物理帧，达到共享的效果。

# 练习8
修改`lib/fork.c`中的`duppage`
实现`lib/spawn.c`中的`copy_shared_pages`函数

``` C
    va = pn*PGSIZE;
    //cprintf("%x\n", va);
    if (uvpt[pn] & PTE_SHARE) {
        if ((r = sys_page_map(thisenv->env_id, (void *)va, envid, (void *)va, uvpt[pn] &  PTE_SYSCALL)) < 0)
            return r;
        return 0;
    }

```

``` C
static int
copy_shared_pages(envid_t child)
{
    // LAB 5: Your code here.
    int32_t va;
    int r;

    for (va = 0; va < USTACKTOP; va += PGSIZE)
        if ((uvpd[PDX(va)] & PTE_P) && (uvpt[PGNUM(va)] & PTE_P) && (uvpt[PGNUM(va)] & PTE_SHARE)) {
            if ((r = sys_page_map(0, (void *)va, child,
                    (void *)va, PTE_SYSCALL&uvpt[PGNUM(va)])) < 0)
                return r;
        }


    return 0;
}
```

代码中的spawn已经实现了，并且加了很多注释，在这做下笔记。
1. 打开程序文件
2. 读取ELF文件头，检测它的魔数(magic number)
3. 使用系统调用`sys_exofork()`创建一个新的环境
4. 设置子进程的初始栈，例如传递的参数
5. 调用`init_stack()`设置好栈页
6. 映射程序的各个段到新环境的内存空间
- 如果ELF文件flag没有包含`ELF_PROG_FLAG_WRITE`，那么短包含了代码正文和只读的数据。
- 如果ELF文件flag包含了`ELF_PROG_FLAG_WRITE`，那么代表这个段包含了可读写的数据和`bss`段
7. 调用`sys_env_set_trapframe`设置子程序的栈
8. 调用`sys_env_set_status`表明程序可以确认运行了。

这里设置栈帧的时候，要压入像`main(int argc, char **argv)`中argc,argv两个参数，这里的操作给出了更加准确的答复(函数init_stack(envid_t child, const char **argv, uintptr_t *init_esp)。
``` C
    string_size = 0;
    for (argc = 0; argv[argc] != 0; argc++)
        string_size += strlen(argv[argc]) + 1;
```
首先确定字符串总长度，并且包含每个字符串结尾的`null`字节。
``` C
    string_store = (char*) UTEMP + PGSIZE - string_size;
    argv_store = (uintptr_t*) (ROUNDDOWN(string_store, 4) - 4 * (argc + 1));

```

string_store ~ UTEMP+PGSIZE用来存放参数中的字符串，argv_store ~ string_store存放argv\[i\]这个二维数组指向各自字符串的指针。

![pic.png]( /images/operating-system/6.828/lab5/pic.png)

``` C
    if ((r = sys_page_alloc(0, (void*) UTEMP, PTE_P|PTE_U|PTE_W)) < 0)
        return r;
    for (i = 0; i < argc; i++) {
        argv_store[i] = UTEMP2USTACK(string_store);
        strcpy(string_store, argv[i]);
        string_store += strlen(argv[i]) + 1;
    }

```
设置栈帧的时候先在UTEMP这分配一个页面，然后才进行存放。这里有一点引起了我注意，argv_storep\[i\]也就是二维数组中的字符串指针都是指向USTACK的，但是字符串的内容还是存放在UTEMP~UTEMP+PGSIZE的范围中，因为最后程序正式开始执行的时候，指针不可能指向UTEMP，所以这里可以看作是一个小tricks。
``` C
    argv_store[-1] = UTEMP2USTACK(argv_store);
    argv_store[-2] = argc;

    *init_esp = UTEMP2USTACK(&argv_store[-2]);
    if ((r = sys_page_map(0, UTEMP, child, (void*) (USTACKTOP - PGSIZE), PTE_P | PTE_U | PTE_W)) < 0)
        goto error;
    if ((r = sys_page_unmap(0, UTEMP)) < 0)
        goto error;
```
接下来就是把argv_store这个在USTACK中对应的位置压栈，它指向字符串指针数组的开头，其次再压入的argc参数的个数，并将esp栈顶指针设置好后映射到USTACK去，解开UTEMP的映射回收内存页，这里就完成了栈的初始化。
PS: 这里的数组角标为负数时头次在C中见到，虽然理解不难，但是看到在python中常用的语法在C中出现还挺意外的。

所以最后`spawn`出来的程序所拥有的栈结构如下：

![stack.png]( /images/operating-system/6.828/lab5/stack.png)

# 键盘接口
为了shell能工作，现在需要一种方式来打字。QEMU已经显示了输入到CGA(Color Graphics Adapter)和串口，但是到目前为止只能在内核的显示器上获取输入。从键盘的输入显示在图形窗口上，然而串口的输入会被显示到控制台上。`kern/console.c`已经完成键盘和串口驱动被用作内核的监视器，但是现在需要附加剩下的功能。
在代码中必定会接触到大量串口操作，与其[外围寄存器](https://blog.csdn.net/jn1158359135/article/details/7583967)相关，现在看着还是挺懵的，所以暂时不去关注端口的实现。


>Q: 串口中断和按键中断有什么区别

# 练习9
分发按键中断IRQ_OFFSET+IRQ_KBD和串口中断IRQ_OFFSET+IRQ_SERIAL。
``` C
    // Handle keyboard and serial interrupts.
    // LAB 5: Your code here.
    if (tf->tf_trapno == IRQ_OFFSET + IRQ_KBD) {
        kbd_intr();
        return;
    }
    if (tf->tf_trapno == IRQ_OFFSET + IRQ_SERIAL) {
        serial_intr();
        return;
    }
```

当键盘键入或者有串口中断发生的时候，串口和键盘分别通过各自的例程获取字符，并且调用`cons_intr`将字符放入结构体cons的缓冲区中，自增写端`wpos`。

``` C
static struct {
    uint8_t buf[CONSBUFSIZE];
    uint32_t rpos;
    uint32_t wpos;
} cons;
```
在当程序需要进行获取输入的时候，会调用`kern/console.c`中的`cons_getc()`，这个函数首先会调用`serial_intr()`和`kbd_intr()`先获取串口或者键盘输入，然后通过将从缓冲区`buf`中获取一个字符，并且自增`rpos`读端。


# 练习10

这个练习基本上就是高层的命令解释器的实现，hw2中已经实现过了。

``` C
    // LAB 5: Your code here.
    //panic("< redirection not implemented");
    if ((fd = open(t, O_RDONLY)) < 0) {
        cprintf("open %s for read: %e", t, fd);
    }
    if (fd != 0) {
        dup(fd, 0);
        close(fd);
    }
    break;
```

和`>`操作一样，代码基本相似，但是可以顺便看一下`pipe`和`dup`的实现。

`dup()`
``` C
int
dup(int oldfdnum, int newfdnum)
{
    int r;
    char *ova, *nva;
    pte_t pte;
    struct Fd *oldfd, *newfd;

    if ((r = fd_lookup(oldfdnum, &oldfd)) < 0)
        return r;
    close(newfdnum);

    newfd = INDEX2FD(newfdnum);
    ova = fd2data(oldfd);
    nva = fd2data(newfd);

    if ((uvpd[PDX(ova)] & PTE_P) && (uvpt[PGNUM(ova)] & PTE_P))
        if ((r = sys_page_map(0, ova, 0, nva, uvpt[PGNUM(ova)] & PTE_SYSCALL)) < 0)
            goto err;
    if ((r = sys_page_map(0, oldfd, 0, newfd, uvpt[PGNUM(oldfd)] & PTE_SYSCALL)) < 0)
        goto err;

    return newfdnum;
}
```

`dup`首先将新的文件描述符关闭，例如dup(fd, 0)会先将0也就是标准输出关闭(写回磁盘，取消物理帧的映射)，然后将fd所指向的数据块和文件描述符所占的页映射到根据文件描述符号转换到的虚存地址去，所以写入标准输出的内容可以写到fd所指向的文件中去了。
`dup`后一般有一个close()操作，这一步只是取消对物理块的引用而已，多出来文件描述符既不安全又不美观。

`pipe()`
``` C
int
pipe(int pfd[2])
{
    int r;
    struct Fd *fd0, *fd1;
    void *va;

    // allocate the file descriptor table entries
    if ((r = fd_alloc(&fd0)) < 0
        || (r = sys_page_alloc(0, fd0, PTE_P|PTE_W|PTE_U|PTE_SHARE)) < 0)
        goto err;

    if ((r = fd_alloc(&fd1)) < 0
        || (r = sys_page_alloc(0, fd1, PTE_P|PTE_W|PTE_U|PTE_SHARE)) < 0)
        goto err1;

    // allocate the pipe structure as first data page in both
    va = fd2data(fd0);
    if ((r = sys_page_alloc(0, va, PTE_P|PTE_W|PTE_U|PTE_SHARE)) < 0)
        goto err2;
    if ((r = sys_page_map(0, va, 0, fd2data(fd1), PTE_P|PTE_W|PTE_U|PTE_SHARE)) < 0)
        goto err3;

    // set up fd structures
    fd0->fd_dev_id = devpipe.dev_id;
    fd0->fd_omode = O_RDONLY;

    fd1->fd_dev_id = devpipe.dev_id;
    fd1->fd_omode = O_WRONLY;


    pfd[0] = fd2num(fd0);
    pfd[1] = fd2num(fd1);
    return 0;
}
```

pipe()首先引起注意的就是权限设置，这也是为什么一段只能读一段只能写。首先为每个描述符提供一个页存储文件结构体，再分配一个页给`0`一个数据页，将这个页映射到`0`和`1`文件描述符对应的数据页，并且将页标记为`PTE_SHARE`。在任意一段尝试读或者写的时候，触发页错误，使用`bc_pgfault`进行实际映射。最后进行权限设置，完成管道的创建。


# make grade

``` C
make[1]: Leaving directory '/home/moonlight/lab'
internal FS tests [fs/test.c]: OK (1.9s)
  fs i/o: OK
  check_bc: OK
  check_super: OK
  check_bitmap: OK
  alloc_block: OK
  file_open: OK
  file_get_block: OK
  file_flush/file_truncate/file rewrite: OK
testfile: OK (1.7s)
  serve_open/file_stat/file_close: OK
  file_read: OK
  file_write: OK
  file_read after file_write: OK
  open: OK
  large file: OK
spawn via spawnhello: OK (1.2s)
Protection I/O space: OK (1.3s)
PTE_SHARE [testpteshare]: OK (2.0s)
PTE_SHARE [testfdsharing]: OK (1.2s)
start the shell [icode]: Timeout! OK (31.4s)
testshell: OK (3.9s)
primespipe: OK (11.1s)
Score: 150/150
```


This completes the lab



这一节实验代码量较小，但是实现了很多日常接触到的概念，例如管道，dup，文件描述符等。在完成实验的时候踩了很多坑，比如虽然通过了阶段性的测试，但是前面留下的错误代码影响到了后面的整个系统，仔细观察程序可以观察到代码都是一层一层抽象上去的，所以越是底层越需要仔细，考虑清楚corner case。每发生一个BUG都花了大量时间去寻找问题所在，这是很不应该的。


