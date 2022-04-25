# apue-file and directory


## 文件类型
stat函数簇(fstat,lstat, lstat, fstatat)是用来获取文件状态的函数，需要提前定义一个结构体`struct stat`来获取这些文件的特殊信息。
文件类型包括`普通文件`，`目录文件`，`块特殊文件`,`字符特殊文件`，`ＦＩＦＯ`，`套接字`，`符号链接`。可以向函数(S_ISREG(), S_ISDIR()...)传入结构体中的st_stat获取文件类型。

## 文件访问权限
1. 读权限允许我们读取目录，获得在该目录下的文件名列表，但是当某个目录是　路径名　的一部分的时候，必须有该目录的可执行权限。
2. 在目录下创建一个文件，是需要对该目录有写权限和执行权限，删除一个文件也是一样，但是不需要对该文件有读写权限。

书上有一个关于access的实例，虽然有些文件可以不能通过可读权限，但是open()函数仍然能打开但是不能用read()等方法进行读操作。

## 文件系统
现代unix和以前学的有些不同，其中JOS不支持inode，但是还是有相似的地方。重新翻了下前面的[文章](1)。文件系统都有一个boot块用来自启，紧接着的是叫做super块来描述文件系统的性质，例如目录地址，上次检错时间等。现代unix在之后的磁盘块中以`超级块副本`，`配置信息`，`Ｉ节点图`，`bitmap`，`ｉ节点`，数据块依次排开构成文件系统。JOS就要简化了一些，因为不存在ｉnode，所以数据和目录都是放在bitmap后的数据块中。

硬链接是指inode的引用计数，当计数为０时才是真正从磁盘中擦去该目录项，保存在结构体stat的st_nlink中。

inode节点包含了文件所有信息，文件类型，文件访问权限位，文件长度，指向文件数据块的指针（JOS中的FILE结构体）。

    $ mkdir test
该命令执行后，会创建一个新的文件目录，任何新目录创建后的引用数都为２．该test目录在创建后，父目录中的`test`指向该目录，以及`test`目录中的 `.`　　也指向该目录，所以引用计数为２。

以此类推，其父目录的引用计数应该为３，１是该目录的父目录的指向，２是该目录下`.`文件的指向，３是`test`文件中`..`的指向。所以没创建一个文件目录，该目录的引用计数都会增加１。

## unlink
当文件的引用计数为０时，就会从磁盘中擦去，像vim打开一个文件，填入内容保存后，就会在该目录下引用了这个普通文件，引用计数为１，使用unlink可以解除即删去该文件。

当一个程序用open()打开一个文件后，马上调用unlink()，那么只有当进程关闭改文件或者进程终止的时候，文件内容才被删除。
```
if (open("tempfile", O_RDWR) < 0)
    err_sys("open error");
if (unlink("tempfile") < 0)
    err_sys("unlink errorr");
```
## 符号链接
符号链接是一种与硬链接相比较限制宽松的链接方式，不用接触到文件系统底层。

使用命令ln来创建一个符号链接

    $ln -s ~/file file

然后使用 ls -l 查看文件

    lrwxrwxrwx 1 moonlight users   26 Aug 14 16:07 sp -> /home/moonlight/hotspot.py
可以看到对一个文件的链接，但是使用cat命令确并不存在。

## 文件的时间
最后访问时间(st_atim) ： 文件数据最后被read操作的最后一次时间。

最后修改时间(st_mtim) ： 文件数据内容最后被write操作修改的最后一次时间。

状态修改时间(st_ctim) ： 文件inode中信息(权限等)被修改的最后一次时间。


## 读目录

这个两百多行的代码是当给定一个目录是，递归获取其目录下的所有文件，首先放在最前面的:
``` C
typedef int Myfunc(const char *, const struct stat *, int);
```
是定义了一个返回类型为int，参数是const char*,const struct stat和int的函数指针类型。
然后声明:
``` C
static Myfunc myfunc;
```
声明了一个类型为Myfunc，变量名为myfunc的函数指针，其中static关键词的作用是用于限定函数作用域。

接下来函数myftw为路径分配一段内存空间来存取路径大小，其中path_alloc是一个第二章的一个实例程序，用于兼容性地分配路径长度。
```
fullpath = path_alloc(&pathlen);
```
此语句的作用是分配一段路径名长度加1的内存空间，最后一个字节存取`/`目录符号，然后进行赋值等操作后执行这个程序的主体`dopath()`。

这个函数的主要作用应该是分类文件，首先`lstat`获取文件信息，然后判断是否为目录文件，如果不是目录文件，直接跳转到`myfunc`进行更加细分的文件类型判断（如普通文件，符号文件，块文件，FIFO，字符文件，套接字等）。

func()是一种回调函数，当调用者将函数指针在调用的时候填入实参的位置时，那么函数就已经被登记，等`func()`进行调用的时候就相当于调用被登记的函数。

如果是目录文件，那么进行递归的准备工作，例如重新分配长度等。
``` C
fullpath[n++] = `/`;
fullpath[n] = 0;
```
该语句的作用是将目录符号进行填充，然后用null截断文件路径。
``` C
while ((dirp = readdir(dp)) != NULL) {
    if (strcmp(dirp->d_name, ".") == 0 ||
        strcmp(dirp->d_name, "..") == 0)
        continue;
    strcpy(&fullpath[n], dirp->d_name);
    if ((ret = dopath(func)) != 0)
        break;
}
```
循环体用于遍历整个文件目录，然后将文件名复制到准备好的目录路径上，在递归查询这个新的文件路径。
``` C
fullpath[n-1] = 0;
```
这个语句的作用就是截断文件目录符号，返回查询上级目录的文件。


## 设备特殊文件
每个文件系统所在的存储设备由主次设备号表示，主设备号表示设备驱动程序，次设备号表示特定的子设备，数据类型是`dev_t`。通常使用`major`,`minor`两个宏来访问主次设备号。st_dev存储了文件系统的设备号，st_rdev是只有块设备和字符设备才拥有的属性。


× minor和major宏是包含在文件`/usr/include/sys/sysmacros.h`中所以需要inlude <sys/sysmacros.h>。

![pic](/uploads/apue/c4/stdev.png)
d
## writeup

### 4.1
stat会跟随符号链接所指向的文件

### 4.６

首先用下面的程序创建一个空洞文件：

``` C

#include "apue.h"
#include <fcntl.h>

int
main(int argc, char *argv[])
{
	int fd = 0;
	char buf1[] = "abcdefg";
	char buf2[] = "ABCDEFG";
	off_t off = 65536;
	size_t memsz = off + strlen(buf1) + strlen(buf2);
	char* buf3 =(char*) malloc(memsz);

	memset(buf3, 32, memsz);

	/*hole file*/
	if ((fd = open("file.hole", O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)) < 0)
		err_sys("error open");
	int n = strlen(buf1);
	if (write(fd, buf1, n) != n)
		err_sys("error write buf1");
	if (lseek(fd, off, SEEK_CUR) < 0)
		err_sys("error seek");
	n = strlen(buf2);
	if (write(fd, buf2, n) != n)
		err_sys("error write buf2");
	close(fd);

	/*nohole file*/
	if ((fd = open("file.nohole", O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)) < 0)
		err_sys("error open");
	if (write(fd, buf3, memsz) != memsz)
		err_sys("error write buf3");
	free(buf3);
	close(fd);

	exit(0);

}

```

会创建一个file.hole和file.nohole的文件，使用`du`命令(disk usage)和`ls`来分别查看实际磁盘使用数，和在文件系统中使用的数量。

``` s

[moonlight@ArchLinux c4]$ ll file.*
-rw------- 1 moonlight users 65550 Aug 23 16:46 file.hole
-rw------- 1 moonlight users 65550 Aug 23 16:46 file.nohole
[moonlight@ArchLinux c4]$ du file.*
8	file.hole
68	file.nohole
```
现在可以做下前面那一章的实验，分别使用cp和cat重定向到一个文件。
```
[moonlight@ArchLinux c4]$ cp  file.hole hole.cp
[moonlight@ArchLinux c4]$ cat file.hole > hole.cat
[moonlight@ArchLinux c4]$ ll hole*
-rw-r--r-- 1 moonlight users 65550 Aug 23 16:59 hole.cat
-rw------- 1 moonlight users 65550 Aug 23 16:59 hole.cp
[moonlight@ArchLinux c4]$ du hole.*
68	hole.cat
8	hole.cp
```
cat遇到文件空洞会进行填０操作，而cp遇到文件空洞则是跳过，所以占用的实际磁盘块不同，文件系统的逻辑大小不会发生改变。Linux的read()遇见空洞也是跳过，所以可以完成一个类似程序。
``` C
#include "apue.h"
#include <fcntl.h>
#define BFSZ 4096

int
main(int argc, char *argv[])
{
	int fd1, fd2;
	int n;
	char buf[BFSZ];

	if (argc != 3)
		err_sys("usage: cp file1 file2");

	if ((fd1 = open(argv[1], O_RDONLY)) < 0)
		err_sys("open file error :%s", argv[1]);
	if ((fd2 = open(argv[2], O_RDWR|O_TRUNC|O_CREAT, S_IRUSR|S_IWUSR)) < 0)
		err_sys("open file error :%s", argv[2]);

	while ((n = read(fd1, buf, BFSZ)) != 0) {
		if (write(fd2, buf, n) != n)
			err_sys("write error");
	}

	exit(0);
}
```

## 4.17
注: 删除文件需要有该目录的可写权限和可执行权限。
