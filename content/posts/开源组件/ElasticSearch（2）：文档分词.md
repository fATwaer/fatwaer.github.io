---
title: "ElasticSearch（2）：文档分词原理"
date: 2021-07-24T22:37:19+08:00
Summary: 包括 Elasticsearch 的CRUD和基础检索方式
draft: false
categories:
  - notes
---

## 分析文档：分词

### 请求分析

``` json
POST _analyze
{
  "tokenizer": "standard",
  "filter":  [ "lowercase", "asciifolding" ],
  "text":      "Is this déja vu?"
}
```

### 为索引设置不同的分词器

``` json
PUT my-index-000002
{
  "settings": {
    "analysis": {
      "analyzer": {
        "std_english": {
          "type":      "standard",
          "stopwords": "_english_"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "my_text": {
        "type":     "text",
        "analyzer": "standard",
        "fields": {
          "english": {
            "type":     "text",
            "analyzer": "std_english"
          }
        }
      }
    }
  }
}

POST my-index-000002/_analyze
{
  "field": "my_text",
  "text": "The old brown cow"
}

POST my-index-000002/_analyze
{
  "field": "my_text.english",
  "text": "The old brown cow"
}
```

分析器也能在elastic search的启动配置中设置。

### 分词过程

文档加入索引前，都会经过系列处理：
1、字符过滤 （char_filter）
2、文本切分 （tokenizer）
3、分词过滤 （filter）
4、分词索引

``` json
POST _analyze
{
  "char_filter": ["html_strip"],
  "tokenizer" : "whitespace",
  "filter": ["stop"],
  "text":      "<body> share your experiece with NoSql and big data technologies </body>"
}
```

给定一个语句 `text` ：`<body> share your experiece with NoSql and big data technologies </body>`

并且设置相应的分词配置。

## ref

- 于是可以形成倒排索引：
<https://dragonsong.tech/posts/rd/es/index_structure/>

- elastsearch 自身支持的分析器：
<https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-analyzers.html>
