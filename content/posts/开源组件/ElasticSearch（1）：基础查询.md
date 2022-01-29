---
title: "ElasticSearch（1）：基础查询"
date: 2021-07-16T22:37:19+08:00
Summary: 包括 Elasticsearch 的CRUD和基础检索方式
draft: false
categories:
  - notes
---


## 文档创建和删除

### 创建文档
ElasticSearch 提供创建一篇文档的接口如下，如果这是索引的第一篇文档，索引也会被同时创建。
```
PUT /<target>/_doc/<_id>
POST /<target>/_doc/
PUT /<target>/_create/<_id>
POST /<target>/_create/<_id>
```

下面的例子利用`PUT`方法创建一个 id 为1的文档：


![1626509597720.png](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/1626509597720.png)


其中，version字段为1，并且result的值为`created`。

另一种创建文档的方式是通过`POST`，又ES自动生成一个全局唯一的 `_id` 给新的文档：


![1626509630285.png](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/1626509630285.png)

### 更新的文档

![1626509615300.png](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/1626509615300.png)


如果重复对这个文档执行PUT操作，那么ES就会转变为更新，并且自增`version`字段。


### 查询索引的信息

因为创建文档的同时会自动创建索引以及和请求结构相关的mappings(类似数据库的表结构schema)

直接通过`GET`索引名就可以查询到索引的信息：

```
GET /<index_name>
```
例如：


![1626511976668.png](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/1626511976668.png)


通常会得到三个信息：
  - aliases： 用于别名
  - mappings：索引的字段信息，如图中的索引 index-001 是根据 POST/PUT 请求的字段自动生成的，并且自动推导成对应的类型，但是对于字符串类型（text）在默认请求下，会新增一个子字段`keyword`，用于精准匹配查询。
  - settings：包含了 ElasticSearch 配置、分片等信息
### 查看文档
文档索引完成后，能够通过下面的查询查到新加入的文档：

```
GET /<index_name>/_doc/1  # 找到 _id 为 1 的文档
GET /<index_name>/_search # 查找出该索引下的所有文档
```


### 删除文档

```
DELETE /<index>/_doc/<_id>
```

例如：

![1626511896634.png](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/1626511896634.png)



如果找到了，会返回`200OK`，并且 `found` 判断是否存在文档，`_version ` 字段在删除成功后会自增


## 常见的查询方式


### 准备查询数据

```
PUT /megacorp/employee/1
{
    "first_name" : "John",
    "last_name" :  "Smith",
    "age" :        25,
    "about" :      "I love to go rock climbing",
    "interests": [ "sports", "music" ]
}
PUT /megacorp/employee/2
{
    "first_name" :  "Jane",
    "last_name" :   "Smith",
    "age" :         32,
    "about" :       "I like to collect rock albums",
    "interests":  [ "music" ]
}
PUT /megacorp/employee/3
{
    "first_name" :  "Douglas",
    "last_name" :   "Fir",
    "age" :         35,
    "about":        "I like to build cabinets",
    "interests":  [ "forestry" ]
}
```
**PS**: `megacorp` 是官方的例子，在下面的例子中，创建的方式和前面叙述的有些不同，官方的例子是在ElasticSearch 2.X出的，
在索引和文档之间，还存在类型这一概念，虽然在后续的版本中可能不再维护，但是在这里用做例子并无大碍。

### 请求的方式


- 基于 URL 的搜索方式：

  GET /megacorp/employee/_search?q=last_name:Smith

- 基于 Request Body 的搜索方式

  ```
  GET /megacorp/_search
  {
    "query": {
      "query_string": {
        "fields": ["last_name"],
        "query": "Smith"
      }
    }
  }
  ```

### 一个完整的请求

```
GET /megacorp/_search
{
  "query" : {
      "match" : {
          "last_name" : "Smith"
      }
  },
  "from": 0,
  "size": 2,
  "_source": ["first_name", "last_name"],
  "sort": [{"age":  "desc"}]
}
```
- query：相当于SQL中的WHERE子句
- from/size： 和SQL的 FROM/LIMIT 用法一致，用于分页
- _\_source_： 相当于 SELECT
- sort：对应 ORDER BY

### 查询返回结构

![IMG_0560.jpg](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/IMG_0560.jpg)

### 查询字符串(query_string)
```
GET /megacorp/_search
{
  "query": {
    "query_string": {
      "fields": ["about"],
      "query": "I AND cabinets"
    }
  }
}
```


### 简单查询字串(simpile_query_string)

`simpile_query_string` 是 `query_string` 的一种优化方式，能够将 AND/OR 关键词简化：
```
GET /megacorp/_search
{
  "query": {
    "simple_query_string": {
      "fields": ["about"],
      "query": "I + cabinets"
    }
  }
}
```

### 全文搜索(match)

```
GET /megacorp/employee/_search
{
    "query" : {
        "match" : {
            "about" : "rock climbing"
        }
    }
}
```

查询在 about 属性上喜欢 rock climbing 的人。`rock albums`和 `rock climbing` 都会被命中。如果字段是设置了 `not_analyzed ` 或者是日期、数字、布尔，也会给定精确匹配的值。

### 短语检索(match_phrase)
```
GET /megacorp/employee/_search
{
    "query" : {
        "match_phrase" : {
            "about" : "rock climbing"
        }
    }
}
```

只有完全含有短语 `rock climbing` 的文档才被检索


### 多字段查询(multi_match)
允许在多个字段上执行相同的查询
```
GET /megacorp/_search
{
  "query": {
    "multi_match": {
      "query": "like music",
      "fields": ["about", "interests"]
    }
  }
}
```

### 范围查询(range)
```
GET /megacorp/_search
{
  "query": {
    "range": {
        "age": {
            "gte":  20,
            "lt":   33
        }
    }
  }
}
```

- gt: 大于
- gte: 大于等于
- lt: 小于
- lte: 小于等于

### 精确值查找(term/terms)
term 查询被用于精确值匹配，这些精确值可能是数字、时间、布尔或者那些 **not_analyzed** 的字符串

```
GET /megacorp/_search
{
  "query": {
    "term": { "age": { "value": "25"} }
  }
}
```

term`s` 查询是 term 的多值版本

```
GET /megacorp/_search
{
  "query": {
    "terms": {
      "age": ["25", "32"]
    }
  }
}
```

---
### 存在性查找(exsists/missing)

exsists 和 missing 是一个逻辑相反的关系，用于判断字段是否有值，类似于 SQL 的`WHERE FieldA IS NOT null`
```
{
  "exists": {
    "field": "title"
  }
}
```

### 前缀查询(match_prefix)

因为目前只有三条记录，分别是：

```
"first_name" : "John",
"first_name" : "Jane",
"first_name" : "Douglas",
```

当期待用 `J` 去匹配John和Jane在first_name字段匹配不会成功，而需要使用字段`first_name.keyword` ：
```
GET /megacorp/_search
{
  "query": {
    "prefix": {
      "first_name.keyword": {
        "value": "J"
      }
    }
  }
}
```
或者使用小写的 `j`，因为 first_name 是一个被分词的字段(analyzed)，在经过一系列的分词器和转化后，存储在倒排索引是小写的单词，而 first_name.keyword 字段是 first_name 的不做分词版本，可以用大写的 `J` 匹配到。
```
GET /megacorp/_search
{
  "query": {
    "prefix": {
      "first_name": {
        "value": "j"
      }
    }
  }
}
```


### 模糊查询和正则表达式(wildcard/regexp)
因为语句会被es分解成词，match查询的最小模糊匹配是词，利用模糊查询就能将模糊粒度降低到字母，如：

```
GET /megacorp/_search
{
  "query": {
    "wildcard": {
      "about": {
        "value": "c*"
      }
    }
  }
}
```

或者:

```
GET /megacorp/_search
{
  "query": {
    "regexp": {
      "about": {
        "value": "c.*"
      }
    }
  }
}
```

数据在索引时的预处理有助于提高`前缀匹配`的效率，而通配符和正则表达式查询只能在查询时完成，尽管这些查询有其应用场景，但使用仍需谨慎。

prefix 、 wildcard 和 regexp 查询是基于词操作的，像语句“Quick brown fox”如果设置了`analyzed `就会被分解成 quick 、 brown 和 fox。

	{ "regexp": { "title": "br.*" }}
语句能够检索到，但是下面这些组合了词语的查询不行

```
{ "regexp": { "title": "Qu.*" }}
{ "regexp": { "title": "quick br*" }}
```
### 复合查询
复合查询使用 `bool` 查询来实现逻辑的组合，接受以下四种参数：

- `must`：    文档必须匹配这些条件才能被包含进来。
- `must_not`：文档必须不匹配这些条件才能被包含进来。
- `should`:   如果满足这些语句中的任意语句，将增加 _score ，否则，无任何影响。它们主要用于**修正每个文档的相关性得分**。
- `filter`:   必须匹配，但它以不评分、过滤模式来进行。这些语句对评分没有贡献，只是根据过滤标准来排除或包含文档。

结构为：
```
"query": {
	"bool": {
	  "must": [ SUB_QUERY ],
	  "must_not": [ SUB_QUERY ]
	}
}
```

例如：
```
GET /megacorp/_search
{
  "query": {
    "bool": {
      "must": [ {"range": { "age": { "gte": 30 } }} ],
	    "must_not": [ {"match": { "about": "cabinets" }} ]
    }
  }
}
```


### 过滤查询(filter)

```
GET /megacorp/_search
{
  "query": {
    "bool": {
      "must": {"match" : {"about" : "like build"}},
      "filter": {
        "bool": {
          "must" : {"range": {"age": { "gte": 30 }}}
        }
      }
    }
  }
}

```

将查询移到 `bool` 查询的 `filter` 的 `bool` 语句中，例如像年龄这样的字段，只需要进行过滤，不需要放在查询做，所以可以放到filter中来优化查询性能。

### 过滤查询(constant_score)
`constant_score` 是filter的另外一种形式，通常用在只进行filter，而不用查询相关性分的情况。

如下：

```
GET /megacorp/_search
{
  "query": {
    "constant_score": {
      "filter": {"range": {"age": { "gte": 30 }}}
    }
  }
}
```



# ref
- [19 个很有用的 ElasticSearch 查询语句](https://n3xtchen.github.io/n3xtchen/elasticsearch/2017/07/05/elasticsearch-23-useful-query-example)
- [elastic search guide](https://www.elastic.co/guide/cn/elasticsearch/guide/current/getting-started.html)