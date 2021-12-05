---
title: "ElasticSearch（5）：高可用保证"
date: 2021-08-15T22:37:19+08:00
Summary: 包括 Elasticsearch 的CRUD和基础检索方式
draft: false
categories:
  - notes
---

## 单节点索引分片

在创建索引时，可以在setting字段中加入分片设置，下面的配置创建了3个主分片和一份副本，即每个主分片一个副本。

```
PUT /blogs
{
   "settings" : {
      "number_of_shards" : 3,
      "number_of_replicas" : 1
   }
}
```

当集群中只有一个节点时，状态为：

![there is an img](/blog/开源组件/imgs/Pasted_image_20210819190821.png)
但是可以看到，`NODE1` 上只有主分片，没有副本分片，因为在同一个节点上既保存原始数据又保存副本是没有意义的。

通过 `_health` 接口查询，
```
GET /_cluster/health
```

其中 status 的值和对应的解释如：

green：所有的主分片和副本分片都正常运行。
yellow：所有的主分片都正常运行，但不是所有的副本分片都正常运行。
red：有主分片没能正常运行。

可以发现此时的集群状态为 `yellow` ，是因为此时没有副本分片。


## 多节点分片

当加入新物理节点后，es集群就会在新节点上创建副本节点，此时集群状态就会转变为`green`，因为所有主副分片都正常运行了。
![there is an img](/blog/开源组件/imgs/Pasted_image_20210819191400.png)
## 多节点负载
当拥有三个节点后，es 会为了分散负载而对分片进行重新分配，分片数据，如：
![there is an img](/blog/开源组件/imgs/Pasted_image_20210819193032.png)
每一个分片都是一个独立的功能完整的搜索引擎，拥有使用一个节点上的所有资源的能力。

## 继续扩容

es 的主分片数量在创建索引的时候，主分片数量就确定了，之后不可以修改，能修改的只有副本节点。

主分片的数目定义了这个索引能够 存储 的最大数据量。

```

PUT /blogs/_settings
{
   "number_of_replicas" : 2
}
```


![there is an img](/blog/开源组件/imgs/Pasted_image_20210819200815.png)

原本3主3副个节点就会扩充到3主6副个节点，这样即使两个节点宕机，也不会丢失数据。其次，有多个副本节点能够获得更高的吞吐，因为在不同的节点上都能处理相同分片的请求了，当然副本节点的数量提升的吞吐取决于机器性能，分片越多，从机器获取的资源也就更少。


# ref
[https://learnku.com/articles/40400](es中的一些属于概念)
