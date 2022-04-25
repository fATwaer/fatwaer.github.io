# 如何进行调试以及性能剖析


> “The most effective debugging tool is still careful thought, coupled with judiciously placed print statements” — Brian Kernighan, Unix for Beginners.

最朴素的debug方法还是使用print，并且在合适的地方插入print语句，过多的日志信息反而会引起混乱，使debug效率降低。

## 日志分级

根据事情的验证程度，可以将事件的严重情况分为：

- `INFO`
- `WARNING`
- `ERROR`
- `CRITICAL`

每当输出日志的时候，在响应事件前面加上前缀，相关的语言应该都有现成的库，根据需求进行选取即可。

对于一个事件运行的程序，比如`daemon`进程，日志输出在响应文件夹，利用`grep`就能很好的查询不同严重程度的事件的发生情况。

日志的位置通常在`/var/log`目录下，例如nginx的日志文件就在`/var/log/nginx`目录下，系统服务`systemd`的地址文件就在`/var/log/journal`目录下。

日志除了写入文件外，还能通过相关配置写入到`套接字`/`远程服务器`上，对日志进行集中处理或存储。

其他：
    - 交互式日志查看工具: [lnav](http://lnav.org/)

## debug 工具

除了GNU项目中的`gdb`和python自带的`pdb`，还有一些能在debug过程中自动显示相关变量以及寄存器值的debug工具：

- [pwndb](https://github.com/pwndbg/pwndbg)
- [lldb](https://lldb.llvm.org/)

## backtrace

利用`strace`可以查询一些系统调用的次数，例如

``` bash
store : ~/go >> ls
bin  pkg  src
store : ~/go >> sudo strace -e lstat ls -l > /dev/null
lstat("pkg", {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0
lstat("src", {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0
lstat("bin", {st_mode=S_IFDIR|0755, st_size=4096, ...}) = 0
+++ exited with 0 +++
```

通过strace获得ls程序调用了多少次lstat。

扩展阅读：
    - <https://blogs.oracle.com/linux/strace-the-sysadmins-microscope-v2>

## 静态分析

静态分析([wiki](https://en.wikipedia.org/wiki/Static_program_analysis))就像是对一个文本直接检查，推断相应的语法错误和可能的语法错误。

例如python有[pyflakes](https://pypi.org/project/pyflakes)，shell脚本有`shellcheck`，在github上也有相关的静态分析工具[集合](https://github.com/mre/awesome-static-analysis)。

## 性能剖析

> Premature optimization is the root of all evil

通常认为过早优化是不好的，有时间可以读下**[Premature Optimization](http://wiki.c2.com/?PrematureOptimization)**。

最简单的性能测试可以通过程序结束的时间减去程序开始运行的时间获得。比如：

``` shell
$ time ls > /dev/null

real    0m0.002s
user    0m0.001s
sys     0m0.000s
```

可以获得三个时间:

- real: 从程序开始到程序结束的时间，包括了I/O，网络的时间
- user：运行用户级别代码的时间
- sys: 运行内核的时间

### CPU

在python中，可以利用`cProfile`模组进行测试每个函数所使用的时间，[line profile](https://github.com/rkern/line_profiler)测试每一行执行时间。

### 内存占用

- c/c++: Valgrind
<https://valgrind.org/>

- python: mem-profiler
<https://pypi.org/project/memory-profiler/>

### 事件采样

#### perf 简介

`perf`工具是Linux下用于性能剖析的工具，执行相应的程序，由内核或者硬件来计数程序所触发的事件。

事件分为几类：

- software events: 完全由内核计数的事件，比如：上下文切换，fault等
- PMU hardware events: 由处理器自己或者性能监控单元PMU(Performance Monitoring Unit)提供，比如这些事件：运行CPU时钟的数量，**失效指令**，L1级cache未命中次数等。由CPU的种类和模型决定。
- tracepoint events：由内核的ftrace实现，并且只能用在2.6.3x等更新的内核。

**失效指令**这个术语是intel中的`instructions retired`，意思是所执行的指令数目，并不包括由于分支预测失败的那一部分指令。

> Instructions Retired:
This event indicates the number of instructions that retired or executed completely. This does not include partially processed instructions executed due to branch mispredictions.

回到`perf`工具，机器所支持的事件列表可以通过list查询:

``` shell
$ perf list

List of pre-defined events (to be used in -e):

  alignment-faults                                   [Software event]
  context-switches OR cs                             [Software event]
  cpu-clock                                          [Software event]

...
```

#### 开始监控一个程序运行

``` bash
$ perf stat -B dd if=/dev/zero of=/dev/null count=1000000
1000000+0 records in
1000000+0 records out
512000000 bytes (512 MB) copied, 0.461866 s, 1.1 GB/s

 Performance counter stats for 'dd if=/dev/zero of=/dev/null count=1000000':

            453.12 msec task-clock                #    0.979 CPUs utilized
                43      context-switches          #    0.095 K/sec
                 0      cpu-migrations            #    0.000 K/sec
               216      page-faults               #    0.477 K/sec
   <not supported>      cycles
   <not supported>      instructions
   <not supported>      branches
   <not supported>      branch-misses

       0.462827938 seconds time elapsed

       0.087344000 seconds user
       0.366061000 seconds sys
```

### 火焰图

利用`perf`工具还有一个比较方便的功能就是生成[火焰图](http://www.brendangregg.com/flamegraphs.html)。

例如，以上面的例子制作一个火焰图:

``` bash
$ git clone git@github.com:brendangregg/FlameGraph.git
$ perf record -F 99 -g dd if=/dev/zero of=/dev/null count=1000000
$ perf script > out.perf
$ FlameGraph/stackcollapse-perf.pl out.perf > out.folded
$ FlameGraph/flamegraph.pl out.folded > myflame.svg
```

就能得到一个`dd`命令执行的调用过程的[*.svg](http://fatwaer.store/flame/myflame.svg)：

![flame](/images/shell/flame.svg)

另外python有`pycallgraph`，golang也有`go tool pprof`工具进行性能剖析。

## 性能监控

### 资源概览

除了经常使用的`top`，还有许多开源的可视化的工具也比较方便。

#### htop

![htop](/images/shell/htop.png)

#### glances

![glances](/images/shell/glances.png)

### 磁盘与I/O

``` bash
# io监控
$ iotop

# 全局系统磁盘空间使用
df -h

# 指定目录占用情况
$ du -sh *

# 交互式磁盘占用工具
$ ncdu
```

### 内存

``` bash
$ free -h
```

### 打开的文件

``` bash
$ lsof
```

### 网络

常用命令：
``` bash
$ ss
$ ip
$ netstat
$ ifconfig
```

### 网络使用情况

#### iftop

![iftop](/images/shell/nethogs/iftop.png)

#### nethogs

![nethogs](/images/shell/nethogs.png)

## MISC

除了这些基本的命令外，还有一些杂项，比如比较两个命令哪个执行得比较快的工具[hyperfine](https://github.com/sharkdp/hyperfine):

![hyperfine](/images/shell/hyperfine.gif)

还有 cgroup/taskset 等工具，其中cgroup需要单独拿出讲，cgroup在Docker中的资源隔离起着重要作用，先挖个坑。

## 参考

- <https://missing.csail.mit.edu/2020/debugging-profiling/>

perf相关:

- <http://perf.wiki.kernel.org/index.php/Tutorial>
- <https://github.com/brendangregg/FlameGraph>

hyperfine:

- <https://github.com/sharkdp/hyperfine>

