---
title: "ElasticSearch（3）：文档如何被实时索引"
date: 2021-07-31T22:37:19+08:00
Summary: 包括 Elasticsearch 的CRUD和基础检索方式
draft: false
categories:
  - notes
---

## ES 分片如何索引文档

一篇文档会被分词分解成一个个词语，生成一个倒排索引，一个倒排索引是一个 Lucene 索引的段，多个段组成一个 Lucene 索引，而一个 Lucene 索引被称之为一个 ElasticSearch 的分片，将多个分片分布式存储形成了 ElasticSearch。
。

![Pasted_image_20210804132530.png](/blog/开源组件/imgs/Pasted_image_20210804132530.png)

## ES 倒排索引的特性

ES 的倒排索引在写入磁盘是 `保持不变的`，这样优势是：

- 不需要锁
- 因为不变性，内核不需要再读取磁盘，直接缓存到内存中请求内存。
- 对于某个索引 filter 缓存将会一直有效
缺点是因为不可变，新加入一个文档都需要重建索引，索引的数据量大小和更新频率可能只能选择其一。

## 更新倒排索引

### 如何更新

为了保持不变性，可以增加新的索引反馈最近的修改，并且使得每个索引都会被查询到，在每一个分片上查询完结果后合并。

### 更新流程

1、新的文档被追加到内存索引缓存中，内存索引缓存会不时地提交到磁盘，此时在内存中，还不可见。

2、缓存被提交的时候，会提交一个新的段（一个新的倒排索引）和一个带有新段名字的提交点到磁盘。

3、被提交到磁盘的新段被读取打开，里面包含的文档可以被搜索。

4、内存缓存被清空，准备接受新的文档。

## 实时搜索

因为按段搜索（多个倒排索引）的存在，一个新的文档从索引到可被搜索（按段写入磁盘）的延迟降低了，但是可能还需要几分钟，因为按段搜索需要调用 fsync 创建一个提交点。但是 `fsync` 操作代价很大; 如果每次索引一个文档都去执行一次的话会造成很大的性能问题。更加轻量的方式是走 refresh API。

refresh 是一种轻量级的刷新，通过 refresh 可以不通过 fsync 就让文档被索引到，因为 refresh 通过 write 的系统调用，将内存中的数据转换成文件系统的页缓存，数据能够被很快的写入（还是在内存中），并且能被 read 系统调用作为文件打开。

下面的API，可以通过设置刷新时间把内存刷新的间隔拉长，默认是1s，如果设置成 -1 那么就是不刷新。
```
POST /_refresh # 所有索引都刷新
POST /blogs/_refresh # 单个索引刷新
PUT my_logs
{
  "settings": {
    "refresh_interval": "60s"
  }
}
```

在被刷入磁盘前,内存中新数据是不能被刷新的，例如：
```
POST my_logs/_doc
{
  "abc" : 1
}
GET my_logs/_search
```
在search API中是60s内看不到新post的数据的。


## 文件系统页缓存

页缓存（Page Cache）是位于内存和文件之间的缓冲区，它实际上也是一块内存区域。页缓存对应文件中的一块区域，如果页缓存和对应的文件区域内容不一致，则该页缓存叫做脏页（Dirty Page）。

页缓存查看：
```
SZKSGD00582  : ~   -> free -h
              total        used        free      shared  buff/cache   available
Mem:            23G        538M         22G        401M        897M         22G
Swap:            0B          0B          0B
```
或者：
```
SZKSGD00582  : ~   -> cat /proc/meminfo
MemTotal:       24629088 kB
MemFree:        23157836 kB
MemAvailable:   23353692 kB
Buffers:           20724 kB
-> Cached:           875168 kB
SwapCached:            0 kB
Active:           538556 kB
Inactive:         807752 kB
Active(anon):     464264 kB
Inactive(anon):   393480 kB
Active(file):      74292 kB
Inactive(file):   414272 kB
Unevictable:           0 kB
Mlocked:               0 kB
SwapTotal:             0 kB
SwapFree:              0 kB
-> Dirty:                 0 kB
Writeback:             0 kB
AnonPages:        407528 kB
Mapped:           185108 kB
Shmem:            411116 kB
Slab:              58664 kB
SReclaimable:      23568 kB
SUnreclaim:        35096 kB
KernelStack:        7648 kB
PageTables:         3396 kB
NFS_Unstable:          0 kB
Bounce:                0 kB
WritebackTmp:          0 kB
CommitLimit:    12314544 kB
Committed_AS:    3829504 kB
VmallocTotal:   34359738367 kB
VmallocUsed:           0 kB
VmallocChunk:          0 kB
Percpu:             1776 kB
AnonHugePages:    190464 kB
ShmemHugePages:        0 kB
ShmemPmdMapped:        0 kB
HugePages_Total:       0
HugePages_Free:        0
HugePages_Rsvd:        0
HugePages_Surp:        0
Hugepagesize:       2048 kB
Hugetlb:               0 kB
DirectMap4k:       15360 kB
DirectMap2M:     3129344 kB
DirectMap1G:    23068672 kB
```

write 系统调用：

1. 用户发起write操作
2. 操作系统查找页缓存
3. 若未命中，则产生缺页异常，然后创建页缓存，将用户传入的内容写入页缓存
4. 若命中，则直接将用户传入的内容写入页缓存
5. 用户write调用完成
6. 页被修改后成为脏页，操作系统有两种机制将脏页写回磁盘
	- 用户手动调用fsync()
	- 由pdflush进程定时将脏页写回磁盘（脏页数据比例过高，脏页缓存占用的内存太多，长时间未刷新）

read 系统调用：

1. 用户发起read操作
2. 操作系统查找页缓存
3. 若未命中，则产生缺页异常，然后创建页缓存，并从磁盘读取相应页填充页缓存
4. 若命中，则直接从页缓存返回要读取的内容
5. 用户read调用完成

## 实时删除

删除操作：每个提交点会包含一个.del文件，包含被删除的文档，被删除的任然可以被搜索到。

更新操作: 旧文档被标记为删除，新版本文档被索引到一个新的段中

## 持久化

虽然通过每秒刷新（refresh）实现了近实时搜索，但是refresh只是写入页缓存，并没有真正写入到磁盘中，我们仍然需要经常进行完整提交来确保能从失败中恢复。es提供了translog（事务日志）机制用于记录操作。类似于redis的aof。

1、一篇文档被索引后会被写入内存缓冲区，并追加到translog。（数据内存中）

![this's an img](/blog/开源组件/imgs/Pasted_image_20210810131414.png)

2、内存缓冲区的数据被写入到一个新段，但是没有fsync，但是可以被用于搜索。（文件系统缓存，仍旧在内存中）

![this's an img](/blog/开源组件/imgs/Pasted_image_20210810131726.png)

3、数据不断积累，执行索引刷新（flush），新的 translog 创建，执行全量提交，内存中的数据写入新段，缓冲区清空，通过fsync将提交点写入硬盘，删除老的translog。
> translog 提供所有还没有被刷到磁盘的操作的一个持久化纪录。当 Elasticsearch 启动的时候， 它会从磁盘中使用最后一个提交点去恢复已知的段，并且会重放 translog 中所有在最后一次提交后发生的变更操作。

> translog 也被用来提供实时 CRUD 。当你试着通过ID查询、更新、删除一个文档，它会在尝试从相应的段中检索之前， 首先检查 translog 任何最近的变更。这意味着它总是能够实时地获取到文档的最新版本。

![this's an img](/blog/开源组件/imgs/Pasted_image_20210810132149.png)
![this's an img](/blog/开源组件/imgs/Pasted_image_20210810132712.png)

flush API 可以用于手动刷新数据，将页缓存刷入磁盘中去。

``` json
POST /blogs/_flush    # 刷新（flush）blogs 索引
POST /_flush?wait_for_ongoing # 刷新（flush）所有的索引并且并且等待所有刷新在返回前完成。
```

持久化也能通过索引的配置来刷新：
``` json
PUT /my_index/_settings
{
    "index.translog.durability": "async", # 异步刷入磁盘，同步为 "request"
    "index.translog.sync_interval": "5s"  # 同步磁盘的间隔
}
```

translog 默认5s刷一次，或者在每次写请求完成之后执行(e.g. index, delete, update, bulk)，因为数据结构简单+顺序写速度较快。整个请求被 `fsync` 到主分片和复制分片的translog之前，你的客户端不会得到一个 200 OK 响应。当然如果希望获得更高的吞吐，并且在同步间隔丢失的数据无所谓，那么可以设置为 async，当请求。

## 段合并

每次refesh都会产生一个段，但每秒刷新很快就会导致段数量太多的问题，从而消耗很多cpu、内存、文件句柄，而搜索请求会查询每一个段，所以段数量越多，搜索数量越多。（就像一个哈希表被拆分成多个哈希表，时间复杂度从O(1)转变成O(n)）

段合并在进行索引和搜索时会自动进行：
1、索引文档时，refresh 创建新段用于搜索
2、合并进程选择大小相似的段在后台合并成大段，不影响索引和搜索
3、新大段被写入磁盘（flush），另外新的小段也被flush到磁盘，新的提交点被创建，translog也会被清空。
4、新段可以被打开搜索
5、老段被删除

![this's an img](/blog/开源组件/imgs/Pasted_image_20210811132719.png)
![this's an img](/blog/开源组件/imgs/Pasted_image_20210811132727.png)

强制合并API：

``` json
POST /logstash-2014-10/_optimize?max_num_segments=1
```

合并大的段需要消耗大量的I/O和CPU资源，如果任其发展会影响搜索性能。Elasticsearch在默认情况下会对合并流程进行资源限制，所以搜索仍然 有足够的资源很好地执行。

## 总结

![this's an img](/blog/开源组件/imgs/Pasted_image_20210825132839.png)

es 的索引写入分成两个部分：

1. 为了内存使得文档能够被快速被搜索，首先被缓存在内存中，再通过 refresh 使得文档可以被及时搜索到，再周期性地写入磁盘提交。
2. 为了保证文档不丢失，translog能够在内存失效的情况下，从磁盘恢复数据。

## ref

- 如何保证 elasticsearch 数据不丢失：<https://segmentfault.com/a/1190000039075240>
