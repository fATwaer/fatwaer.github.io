---
title: "ElasticSearch（6）：执行分布式搜索"
date: 2021-08-26T22:37:19+08:00
Summary: 包括 Elasticsearch 的CRUD和基础检索方式
draft: false
categories:
  - notes
---


### 集群搜索流程

我们可以发送请求到集群中的任一节点。 每个节点都有能力处理任意请求。 每个节点都知道集群中任一文档位置，所以可以直接将请求转发到需要的节点上。
1、当请求到达一个节点，那么这个节点就会变成协调节点
2、协调节点把搜索请求发送到其他节点的索引分片上搜索数据
3、然后再汇总数据返回给客户端。

![there is an img](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/Pasted_image_20210818194118.png)


文档路由的规则比较常见，对文档ID进行hash得到具体分片，es 不能扩容，扩容就会存在节点对应不上的情况。


### 分页集群搜索流程

请求如：
```
GET /_search
{
    "from": 90,
    "size": 10
}
```

的查询流程如下：

![there is an img](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/Pasted_image_20210729132723.png)

1.  客户端发送一个 `search` 请求到 `Node 3` ， `Node 3` 会创建一个大小为 `from + size` 的空优先队列。
2.  `Node 3` 将查询请求转发到索引的每个主分片或副本分片中。每个分片在本地执行查询并添加结果到大小为 `from + size` 的本地有序优先队列中。
3.  每个分片返回各自优先队列中所有文档的 ID 和排序值给协调节点，也就是 `Node 3` ，它合并这些值到自己的优先队列中来产生一个全局排序后的结果列表。

PS：搜索请求被发送到某个节点时，这个节点就变成了协调节点

并且：注意是 from + size，而不是 size，因为每个节点的数据不一定是排好序的，当from很大的时候会有**深分页**存在，多个节点需要返回很多数据，协调节点进行排序，所以会占用相当多的CPU/内存/带宽。“深分页” 很少符合人的行为，人的行为一般停留在前几页，深分页一般是爬虫。


获取集群状态：
```
GET _cluster/stats?pretty
```

获取分片状态：

```
GET /_cat/shards/<target>
GET /_cat/shards
```


## ref

- es官方教程：<https://www.elastic.co/guide/cn/elasticsearch/guide/current/distributed-search.html>