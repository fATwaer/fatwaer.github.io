# 6.824 Notes：MapReduce、GFS、Raft


最近这段时间有一些空闲时间，可以开始做下6.824，目前是Spring 2018，最新的2019也快出了，提前刷下notes和paper。

分布式系统是关于多个计算机系统共同合作并且进行存储大量的网站数据，执行mapreduce，端对端共享的一种系统，大量的关键基础设施都是分布式的。

分布式系统的`优点`是能够组织物理上分离的实体，通过`isolation`取得系统安全，通过`replication`获取容错机制，通过并行`CPUs/mem/disk/net`来比例提升系统速度。

当然也有些`缺点`，这些过程中必须需要处理大量的并发部件，必须应对部分组件失效，以及很难获取一些潜在的性能。

## MapReduce(2004)

    input is divided into M files
    [diagram: maps generate rows of K-V pairs, reduces consume columns]
    Input1 -> Map -> a,1 b,1 c,1
    Input2 -> Map ->     b,1
    Input3 -> Map -> a,1     c,1
                        |   |   |
                        |   |   -> Reduce -> c,2
                        |   -----> Reduce -> b,2
                        ---------> Reduce -> a,2

对于输入的文件，首先将其分为 M 个文件，对于每一个文件调用一个 Map()作为一次作业，每一个Map()调用产生一组 <k2, v2>键值对(图中的一行)作为中间数据。

MapReduce聚集键为 k2 的所有中间值，将其传输给Reduce()调用，并且以 <k2, v3> 的集合作为最终输出存入到Reduce的输出文件中。也就形成了最后的形式API形式：

    map(k1, v1) -> list(k2, v2)
    reduce(k2, list(v2) -> list(k2, v3)]

MapReduce 隐藏了很多关键的细节，l如启动处于服务器上的软件，跟踪任务是否完成，数据的移动，从错误中恢复等。


### MapReduce 过程

[Paper](https://static.googleusercontent.com/media/research.google.com/zh-CN//archive/mapreduce-osdi04.pdf)中共分为7个步骤：

![mapreduce1.png]( /images/distributed-system/6.824/notes/mapreduce1.png)

1. MapReduce将输入文件分成M份，并且开始在集群的机器上运行该程序的拷贝。
2. 其中有该程序拷贝的Master节点会为集群中剩下的workers分配任务，其中有M份map任务和R份reduce工作，并且master将会为处于闲置状态的worker分配map或者reduce任务
3. worker被赋予了map任务将会从对应的input分片中读取内容，并且将从中解析出的k/v键值对传递到user-defined函数中。(这些由map()产生的k/v对被缓冲在内存中)
4. 这些中间值将会被周期性的写到worker的本地磁盘，并且被partitioning function分成R份区域。这些被写到磁盘的键值对的位置将会被传回给master，并且可靠地将这些定位推进到reduce worker
5. 当reduce worker被Master告知了这些键值对的定位，使用RPC读取这些在map worker本地磁盘缓冲的数据，当reduce worker读取到了所有的中间值，接下来会根据key值进行分组。
6. reduce worker将会遍历这些排序好的中间值，并且将遇到的每一个独一无二的key值，传递到user的Reduce function中，该函数的输出最后会附加到最终输出中去。
7. 当所有map和reduce的任务完成后，master将会唤醒user program，此时 MapReduce调用已经返回到用户代码中。

其中
没有reduce worker会在map任务完成之前被调用。

中间值将只会在网络中出现一次，map从分布式文件系统中进行本地复制，执行Map然后写本地磁盘，通知Master通知reduce worker从该位置远程读取数据，然后写到reduce worker的本地磁盘。

根据以上的条件，有一种非常坏的情况就是N-1台服务器等待最后一台服务器完成任务，整个系统都在等待其完成任务。解决办法是使得任务数目要多余主机数，master需要递送新的任务给已经完成任务的workers,最后的结果是较快的servers会比较慢的servers完成更多的工作,但是绝对时间是相同的。

### 容错处理

1. Map worker 崩溃
master多次ping崩溃的主机仍没有回应，并且Map的输出已经丢失了，但是后面的每一个reduce任务都需要该结果。如果reduce worker已经完全拉取了中间值，并且在reduce的过程中又发生了crash，则会强制执行失效map。
2. Reduce worker 崩溃
如果在worker上的任务已经完成则没有关系，因为已经存储到了分布式文件系统中了，如果是在执行过程中发生了崩溃，则在新的worker上启动未完成的工作。
3. Reduce 在输出结果集发生了崩溃
在reduce工作完成前是不可见的，整个reduce到输出文件都是保持原子性的，这保证master重新在其他地方执行任务。


## RPC

    Client:
        z = fn(x, y)
    Server:
        fn(x, y) {
        compute
        return z
        }
RPC简单来说就是客户端通过tcp连接调用远程服务器中的函数并且获取值的一个过程，GoLang中自带了rpc库。如果rpc库调用失败，可能有几种情况，比如服务器根本没有收到这个请求，可能收到了请求并且执行了相关调用，但是崩溃在发送之前，或者在发送后该数据包迷失在了网络中。

最简单的方法模式的“尽最大努力交付”：
1. 客户端调用rpc，并且等待
2. 如果没有响应，则重传
3. 重传多次无果，返回错误值

尽最大努力交付这种模式只适合一些多次操作不会进行写操作的调用，比如读操作，检查db记录是否被插入等等。


## GFS(2003)

GFS支持一些常见的文件操作，例如create, delete, open, close, read, write等，另外还有snapshot和record append的操作。

### GFS的结构
一个GFS集群由一个master节点和多个能被clients访问的chunkservers组成。通常是是一些商业linux机器运行着用户级别的服务器进程，并且可以让clients和chunkserver的进程运行在同一个机器上面。

文件被分成固定大小的chunksize(一般为64MB), 并且每一个chunk都在创建期间被master一个全局不可变的chunk handle，并且默认情况下，每一个chunk都有三份备份。

master负责维护整个系统的metadata，其中包括了命名空间，访问控制信息，文件到文件系统的映射信息，以及当前状态chunk服务器的位置，并且使用周期性的HeartBeat消息来给予指令或者收集chunk的状态。

client不会从master节点读写数据，取而代之的是获取chunkserver的信息，并且缓冲这些信息在一段时间内，并且进行接下来的系列操作。



GFS的读取操作:

![gfs1.png]( /images/distributed-system/6.824/notes/gfs1.png)

1. 首先，client将文件名和字节偏移转化为chunk索引，然后发送给master一个包含文件名和该索引的请求。master回复对应的chunk handle和各个备份的位置。client缓冲这些信息，以文件名和chunk index作为key值
2. 然后，client发送请求到其中的一个备份去，一般选择最近的，这个请求中包含了chunk内偏移，然后chunk将数据回复给clients。


GFS的写操作：

![gfs2.png]( /images/distributed-system/6.824/notes/gfs2.png)

1. 客户端请求master获取一份持有lease的chunk server
2. master回复主备份的节点id和其他备份的位置，client缓冲这些数据。并且在这些备份地址不可达的时候，重新请求master节点。
3. client推送数据到到所有的拷贝，并且chunkserver将会缓冲这些数据到基于LRU的缓冲区直到数据被使用或者超时。
4. 一旦所欲的拷贝都回复确认收到了该数据，client将会发送写请求到主拷贝节点，主拷贝将会复制一串连续的数字给所接收到的数据变动，并且将这连续的数据变动应用到本地。
5. 主拷贝将会向前推送写请求到所有的第二级拷贝，并且所有的拷贝对数据的变动与拷贝相同
6. 第二级拷贝将会回复主拷贝已经完成了这个操作
7. 主拷贝将会回复client，在变动过程中发生了任何错误都会回复给client。


## Raft(2014)

推荐下这个视频，结合那篇paper一起看比较容易理解
https://www.youtube.com/watch?v=YbZ3zDzDnrw

raft 协议主要是可理解性，相对于paxos来说简单了很多，raft也是提供了在非拜占庭错误([non-Byzantine fault](http://www.itboth.com/d/Q32eua))下一种新的并发模型。

![raft1.png]( /images/distributed-system/6.824/notes/raft1.png)

当clients向其中一个sever提交一个操作的时候，该操作首先会被放入log中，然后使其他的servers也记录该操作，当大多数的机器正确回复了请求后，那么该操作就会被提交到该服务器的状态机，从而完成一个完整的操作，当多个操作开始执行的时候，都会以相同的顺序进行执行。

raft中所有的server在某一时刻会扮演三种角色中的一种：
Leader：　处理client的交互，日志复制，并且同一时刻，只会有一个leader

Follower：　完全处于被动状态，不会产生RPC，但是会回应即将到来的RPC

Candidate：　将会被选举成一个新的leader

在raft协议中，时间被分为以term为单位的时间片段，term有如下的性质：

![raft2.png]( /images/distributed-system/6.824/notes/raft2.png)

1. 每一期被分为选举时间和普通操作时间。
2. 每一期最多有一个leader
3. 有些时期可能没有leader，之后提到的一些选举失败的情况中会出现。
4. 每一个server中都会维护一个`当前期数`的值，用于server发生crash或者unreachable的时候

期数在raft中是个非常重要的概念，用于指示server中哪些数据已经过时了


Raft　大体上可以分成６个部分

### 1.Leader election

1. 最开始的时候，所有的服务器在raft中以follower的角色启动
2. follower期待来自leader或者candidates的rpc
3. leader必须发送心跳包(空的AppendEntries　RPC)来维护自己的权威性
4. 如果electionTimeout到了并且没有接收到rpc，那么
    - follower将会假定leader崩溃了
    - follower开始新的选举
    - timeout的时长通常为100-500ms

选举的过程：
- 自增当前的期数
- 从follower改变至candidate状态
- 为自己投票
- 发送RequestVote RPC到其他服务器，如果没有收到回复，那么一直重传至：
    1. 接受到大多数的服务器的投票，那么该服务器变成leader并且发送心跳包到其他服务器
    2. 接收到来自合法leader的RPC，那么该服务器回到follower的状态
    3. 没有任何一个服务器赢得该轮选举，那么自增期数，开始新的一轮选举(splite vote　term的产生)，新开始的一轮的时期通常选为electionTimeout T~2T之间

### 2.Normal operation

![raft3.png]( /images/distributed-system/6.824/notes/raft3.png)

每一个日志条目(log entry)由三个部分组成：index, term和command，并且都会存储在稳定的存储介质中，例如磁盘。

log的并发处理:　1. 如果在不同的服务器上面日志条目有相同的index和term，那么表示这些条目存储了相同的命令并且之前的条目也是准确的。2.　如果一个条目是被committed的，那么之前的所有条目也是被committed的

一个条目被称之为`committed`则说明这个条目已经被存储在了大多数的服务器上面，并且最终会在集群每个服务器的状态机上执行。

正常运行过程：
1. client发送一个命令到leader
2. leader将会把这个命令附加到其log上
3. leader发送AppendEntries RPC到follower
4. 一旦一个新的entry是committed，那么代表:
   - leader把这个命令应用到状态机上并且返回结果给client
   - leader将会给已经提交该条目发送接下来的AppendEntries RPC
   - follower把该命令提交到自己的状态机上面

每一个AppendEntries RPC会包含需要附加位置之前一个的index, term，如果不相符合，follower将会拒绝这个请求。

### 3.leader changes
leader发生改变最重要的一点是，leader的log总是对的，在follower中发生冲突的条目将会被删除。

在选举期间，candidate最有可能是包含了的最多已经committed条目的服务器，在RequestVote RPC中，包含了candidate最后一个条目的index和term，收到该请求的服务器将会与自己的最后期数进行对比，如果自己的期数等于candidate的期数或者期数相等但是自己的最后的索引大于candidate的索引，那么将会否决投票，这样就保证leader拥有最完整的log。

修复follower的log，新的leader必须使follower的log与自己的一致，删除那些不想管的条目并且填充缺少的条目，leader会为每一个follower保持一个nextIndex，初始值为(1 + leader's last index)，当一个一个AppendEntries RPC失败了，对应的nextIndex将会进行递减并且重新尝试。如果follower覆盖了不一致的条目，那么follower将会删除接下来所有的条目。

![raft4.png]( /images/distributed-system/6.824/notes/raft4.png)

### 4.Neutralizing old leader
假设出现这种情况，需要使得旧的leader无效：
- 暂时性地从网络中断开
- 剩下的其他服务器选举出一个新的leader
- 旧的leader重新连接到集群网络并且尝试去提交日志条目

terms用来检测过时的leader或者candidate，每个rpc中都包含有sender的期数，如果发送者的期数更低，那么rpc将会被接受者拒绝，并且发送方将会转变为follower并且更新其自己的期数。相反，如果接受者的期数更低，那么接收者变成follower，并且更新自己的期数然后正常处理rpc

### 5.clients interaction

- client发送命令到leader，如果不知道leader的位置，联系任何一个已知的服务器，最终将会重定向到leader处。
- 除非命令已经被状态机logged，committed，并且exectued，leader不会进行回复该请求。
- 如果一个请求超时了，client需要重新发送命令到其他的服务器。

但是多次重新发送同一个命令会引起多次执行，所以client必须嵌入一个独一无二的id到每一个指令中去，服务器也将会接受该id到日志条目中去，在接收新来的指令之前，leader会检查其日志的该id，如果找到了，将会无视新的指令，但是会返回原来执行过的结果。


### 6.configuration changes

配置发生改变是指，该集群中某些机器失效了或者需要新的机器来代替原来的机器等等更改集群物理配置的一些改变。集群配置变更不能直接发生变化，例如决策的处理等等。

raft使用`2-phase`的途径来处理这种情况：

![raft5.png]( /images/distributed-system/6.824/notes/raft5.png)

C(old)表示需要在旧配置上的大多数服务器进行决策，而C(old)+C(new)代表需要在旧配置的大多数服务器上通过并且同时需要在新配置的大多数服务器上通过决策。





