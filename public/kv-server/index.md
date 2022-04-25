# 6.824 Lab3 Fault-tolerant Key/Value Service


## 强一致性Key/Value服务

其实在写完Raft后，K/V的接口已经比较明显了，只需要将操作写入Raft entry的Command内，然后等待Raft的同步，再应用到状态机（例如`map[string]string`）即可，但是实际上在跑3A测试的时候还是出现了很多问题。

### 并发(Concurrency)

虽然保证同一个客户端同时只会发送一个Put或者Get请求，但是在面对多个客户端时，如何处理这些请求，并且将这些请求写入到Raft的log entry中。老生常谈的问题，但是在这里处理比较简单，在Raft开始协调一个新的共识(Agreement)的时候,也就是start()，已经使用了mutex来附加新的entry到log中。

### 网络不可靠(Unreliable)

这里是在3A碰到的第一个要认真考虑的点，如果一个RPC请求（比如append “1”->"2"）经过了慢速网络而触发了重传，导致这个RPC被调用了两次，所以在Hint中有提醒，让client的每一个请求都有一个独一无二的ID来保证每个操作只能被执行一次。而如何使得每个操作只会被执行一次，并保证幂等性，还需要考虑到接下来的几个情况。

### 服务器主机崩溃(Crash)

服务器主机崩溃的情景里要考虑的不是网络问题，而是当发生了主机崩溃，往往代表着新的一轮选举和新的leader诞生。所以当真正发生leader切换的时候，客户端需要做的事情是将当前的RPC重新发往新的leader。另外一点是持久化问题，这个会在快照机制中遇到一些需要思考的点。

### 网络分区(Partition)

由于是实现一个强一致性的KV服务，在并发条件下，每一个Get/Put/Append操作都会被按顺序执行一次，而每次调用都需要监控之前的操作序列所做的操作所带来的影响，就好像在调用前，前面的所有的调用已经完成，通常称其为[线性化](https://en.wikipedia.org/wiki/Linearizability)。

最先碰到网络分区和检查一致性是`TestOnePartition3A`，这个测试中做了如下几件事情：

1. 创建一个5个server的kv服务器集群
2. 客户端请求: `Put:1 -> 13`
3. 建立网络分区，3台主机处于大多数(majority)，另外两台主机(保证有一台是leader)处于少数(minority)。
4. 往majority中提交`Put:1->14`
5. 检查majority
6. 往minority中提交操作`Put:1 -> 15`和`Get:1`
7. 检测6中两个操作是否会成功
8. 往majority提交`Put:1->16`并检查
9. 合并两个分区，检查最后Key 1的值。

最后的值应该为15，在这里碰到的一致性检查是关于第六步Get操作，从Raft可以知道在minority中提交的操作是不会被commit的，更不会被应用到状态机，此时minority中的key 1的值是13，相比于majority中的14，是一个过期的值，所以6步中的Get RPC在分区合并前不应该返回。

当分区合并后，minority的leader会被majority中的新leader的心跳设置为follower，所以旧leader的kv服务应该检测到自己不再是leader而返回现存的RPC：`Put:1 -> 15`和`Get:1`，使客户端重定向到新的leader。

而`Get`什么时候返回？这个在Hint中也提到了，最方便的做法就是将Get也塞入raft的log entry内，在这种情境下，处于minority分区的Get操作就会被读取到过期的数据。

### 标识操作(UniqueID)

如何为每一个操作定独一无二ID？我的做法是每个操作维护三个变量以及新加一个RPC用于客户端注册：

1. seriesN：每个客户端初始化为-1，每执行一次Get/Put/Append调用前自增1。
2. Client ID：初始化为-1，用于辨识客户端，由kv服务端来分配，客户端进行维护。
3. Server ID：代表分配Client ID的服务端，用于解决同一个操作因为leader切换而造成ID冲突。

每当启用一个新的客户端并且提交操作时，先自增seriesN，如果`Client ID`为-1，就会向服务端注册自己，即请求一个可用的`Client ID`，并设置`Server ID`。每当一个操作在raft中达成共识时，应用到状态机后，应该记录Cid和Sid的最大值，用于防止重复的操作被提交到状态机。

当出现小于当前seriesN的操作出现时，需要返回一个duplicate的错误告知客户端。

考虑下面这种情景：

``` code
s1 | x = 0 | x += 1
同步到其他server
s2 | x = 0 | x += 1
s3 | x = 0 | x += 1
s4 | x = 0 | x += 1
s5 | x = 0 | nil
```

---

1. leader s1 提交了一个 x += 1 的操作后，并同步到了s2, s3, s4，然后发生分区。
2. s2 当选新一轮的leader，并同步完成
3. s1 恢复到该分区中，被s2的心跳转变为follower
4. client对s1的rpc被返回，重定向到s2，重复的op被提交。

这里也可以通过比较相同clinetID的seriesN来决定是否应用到状态机，但是如果第一步中，x += 1 并没有提交到s1以外的服务器，s2服务器当选leader后先为另一个client分配了相同的client ID，在分区合并前提交过几次操作，那么 x += 1的操作将会被驳回，所以这里需要server ID处理命名空间的冲突。

既然服务端要分配client ID，那么如何记住这些id以应对服务器崩溃，比较简单的办法是分配一个client ID后就做一次持久化，因为真正进行提交操作的client并不是很多也并不频繁。另外一种方法是根据raft的applyMsg会带有Sid，Cid，SeriesN三者，所以当服务crash后重启时，会随着一致性检查恢复之前自己已经分配过的Cid。

Part A内容的大致就是这些，还剩一些优化的细节，比如client在找到server后就记住server的索引，没必要每次都向集群所有服务器发送请求。关于RPC，配置到服务器上时，没必要为每次RPC都新建一次连接，应该维护住这个连接直到主动断开或者发生错误。

## 快照(Snapshot)

快照机制主要作用是两点:

- 一是压缩日志，实际系统中，日志不能在内存中无限增长，如果没有相关机制清理陈旧的信息，那么会产生可用性的问题。日志压缩除了利用快照机制外，在Raft论文中还有提到了利用LSM-Tree对Raft的日志进行增量压缩的方法，由于保证日志的增长是顺序的，在这里利用日志结构树能承受住更高的I/O吞吐量。
- 第二点是在写Lab中发现的，拥有快照机制的Raft能够更快地使落后的(发生了崩溃或者网络分区)follower恢复到同步水平。

### Snapshot要做什么

![snapshot](/images/distributed-system/6.824/lab3/snapshot.png)

快照所做的事情也比较简单，主要针对的是那些已经提交过的条目(即在大多是中达成共识)进行压缩，让这些条目所应用后的状态有一个备份，然后再将这些进行截断即可。因为没有必要每应用一个条目就执行一次快照，所以在应用到状态机后，可以设置一个阈值与当前在内存中的raft log进行比较，当超过这个阈值后执行日志压缩，这也就是3b主要需要做的事情。

3B部分最难处理也就是如何进行日志截断、什么时候进行日志截断、截断后需要重新设置哪些值，在想好这三个问题后动手会减少大量的debug工作。

### 什么时候进行截断

截断的时间是发生在应用到状态机后检测到raft log的大小已经增长超过了阈值，于是kv服务将自己的状态`map[string]string`进行保存，随着logIndex一起递交给自己的raft，raft根据index获取到最后条目的term，进行持久化，然后截断自己的日志。

### 如何进行日志截断

截断首先要考虑到截断后对其他操作的影响：

1. raft负责发送appendEntry的操作，对于落后的机器可能会读取到陈旧的条目
2. raft收到appendEntry，常常发生于旧leader对最新的服务器(leader和follower)发送的心跳
3. raft收到InstallSnapshot后，会有log的截断操作

> InstallSnapshot RPC: 6. If existing log entry has same index and term as snapshot’s last included entry, retain log entries following it and reply

这些操作本质上都是数组下标界限的问题，需要根据实际逻辑进行判断。

另外一点就是关于Golang的切片内存模型，因为在这里raft log是以切片进行保存，所以类似于`arr[beg:end]`的操作只是移动指向底层的指针和长度，所以这里得需要新分配一个切片给rf.log。

![slice](/images/distributed-system/6.824/lab3/slice.png)

### 截断后需要重新设置哪些值

首先是在论文里的LastIncludeIndex和LastIncludeTerm，这两个变量可以维护在raft的状态里，以免每次都需要进行一次I/O读取这两个变量。因为需要维护这两个变量，所以每当要`读取和写入`快照时都需要更新。

另外一对重要的值是commitIndex和applyIndex，根据raft论文:

> If commitIndex > lastApplied: increment lastApplied, apply log[lastApplied] to state machine

这种情况在InstallSnapshot内要着重考虑，因为InstallSnapshot的LastIncludeIndex会大于当前的commitIndex，当某台follower还在apply到状态机的时候，收到了快照，需要做的事情是，应用完上一个快照后，检查自己的applyIndex和commitIndex。而在InstallSnapshot内需要做的事情除了设置LastIncludeIndex和LastIncludeTerm，还同时提高applyIndex和commitIndex。

中断的之前的apply过程并不会导致不一致，在安装完快照后，需要重置kv的状态机，所以不用担心同步问题。

### 快照与K/V服务

3A部分中的kv服务是通过一致性检查后，一个一个地从0开始恢复状态，把以前的操作重新做一遍来恢复自己已分配掉的client ID，因为这个ID是会保存在raft的log中，对日志压缩也就会造成这些信息丢失，所以将当前已经分配掉的client ID写入到快照是有必要的。

## 部署后的 K/V 服务

- Server 1:
  state: <http://fatwaer.store/kv/state.html>
  log  : <http://fatwaer.store/kv/log.html>
- Server 2:
  state: <http://106.13.211.207/kv/state.html>
  log  : <http://106.13.211.207/kv/log.html>
- Server 3:
  state: <http://18.162.39.157/kv/state.html>
  log  : <http://18.162.39.157/kv/log.html>

## 参考资料

- 《数据密集型应用系统设计》
- 《Unix网络编程：卷1》
- <https://blog.golang.org/go-slices-usage-and-internals>
- <https://pdos.csail.mit.edu/6.824/papers/raft-extended.pdf>

