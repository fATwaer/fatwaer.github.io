---
title: "ElasticSearch（4）：相关性计算"
date: 2021-08-07T22:37:19+08:00
Summary: 包括 Elasticsearch 的CRUD和基础检索方式
draft: false
categories:
  - notes
---
## 相关性计算

使用前面的例子，索引中目前一共三个文档：

> “I love to go rock climbing”
> “I like to build cabinets”
> “I like to collect rock albums”



```
GET /megacorp/_search
{
    "query" : {
        "match" : {
           "about" : "rock climbing"
        }
    },
    "explain" : true
}
```

在 `_search` 的时候加上 explain 选项就能在结果中输出相关性计算解释。

```
 		"_explanation" : {
          "value" : 1.4167401,
          "description" : "sum of:",
          "details" : [
            {
              "value" : 0.4589591,
              "description" : "weight(about:rock in 0) [PerFieldSimilarity], result of:",
              "details" : [
                {
                  "value" : 0.4589591,
                  "description" : "score(freq=1.0), computed as boost * idf * tf from:",
                  "details" : [
                    {
                      "value" : 2.2,
                      "description" : "boost",
                      "details" : [ ]
                    },
                    {
                      "value" : 0.47000363,
                      "description" : "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                      "details" : [
                        {
                          "value" : 2,
                          "description" : "n, number of documents containing term",
                          "details" : [ ]
                        },
                        {
                          "value" : 3,
                          "description" : "N, total number of documents with field",
                          "details" : [ ]
                        }
                      ]
                    },
                    {
                      "value" : 0.44386417,
                      "description" : "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                      "details" : [
                        {
                          "value" : 1.0,
                          "description" : "freq, occurrences of term within document",
                          "details" : [ ]
                        },
                        {
                          "value" : 1.2,
                          "description" : "k1, term saturation parameter",
                          "details" : [ ]
                        },
                        {
                          "value" : 0.75,
                          "description" : "b, length normalization parameter",
                          "details" : [ ]
                        },
                        {
                          "value" : 6.0,
                          "description" : "dl, length of field",
                          "details" : [ ]
                        },
                        {
                          "value" : 5.6666665,
                          "description" : "avgdl, average length of field",
                          "details" : [ ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "value" : 0.95778096,
              "description" : "weight(about:climbing in 0) [PerFieldSimilarity], result of:",
              "details" : [
                {
                  "value" : 0.95778096,
                  "description" : "score(freq=1.0), computed as boost * idf * tf from:",
                  "details" : [
                    {
                      "value" : 2.2,
                      "description" : "boost",
                      "details" : [ ]
                    },
                    {
                      "value" : 0.98082924,
                      "description" : "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                      "details" : [
                        {
                          "value" : 1,
                          "description" : "n, number of documents containing term",
                          "details" : [ ]
                        },
                        {
                          "value" : 3,
                          "description" : "N, total number of documents with field",
                          "details" : [ ]
                        }
                      ]
                    },
                    {
                      "value" : 0.44386417,
                      "description" : "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                      "details" : [
                        {
                          "value" : 1.0,
                          "description" : "freq, occurrences of term within document",
                          "details" : [ ]
                        },
                        {
                          "value" : 1.2,
                          "description" : "k1, term saturation parameter",
                          "details" : [ ]
                        },
                        {
                          "value" : 0.75,
                          "description" : "b, length normalization parameter",
                          "details" : [ ]
                        },
                        {
                          "value" : 6.0,
                          "description" : "dl, length of field",
                          "details" : [ ]
                        },
                        {
                          "value" : 5.6666665,
                          "description" : "avgdl, average length of field",
                          "details" : [ ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
```


从返回结果中可以看到，其实相关性计算的分数是	rock 和 climbing 两个词语的相关性分数相加而成：

	score = score(rock) + score(climbing)

而每个词语的分数的计算公式为：

	score(single word) = boost * idf * tf

其中 `boost` 在这里先可以理解为常量，重点在于词频 tf (Term Frequency) 和逆文档频率 idf (Inverse Document Frequency)。词频表示在这篇文档中出现的次数，出现次数越多也就更加相关，逆文档频率是指含有这个词的文档的数量的逆，也就是说这个词在所有文档中出现得越频繁，这个词就越不重要。

更加具体的计算公式在 explaination 中也描述得特别清晰：

其中 idf 的计算公式为：

![there is an img](/blog/开源组件/imgs/MommyTalk1629458124028.png)
- `n` 为含有该词语文档的个数

- `N` 为含有这个字段的文档总数（包括曾经被索引过的文档数）


tf 的计算公式为：
 ![there is an img](/blog/开源组件/imgs/MommyTalk1629459556826.png)

 公式中有`k1`，`b` 这两个常量，在这里先不用关系它们。变量有 `freq` 代表词语在文档中出现的频次，`avgdl` 平均文档长度，以及 `dl` 当前文档长度。我们可以稍微化简下公式：


 ![there is an img](/blog/开源组件/imgs/MommyTalk1629458073299.png)

那么就能分析到，`freq` 越大，频次越高，文档也就越相关；`dl` 越大，值就会更小，文档就更加不相干；`avgdl` 越大，平局文档长度越长（词越稀有），文档就会越相关。

# 计算

rock in 0:
- score = boost * idf * tf
- boost = 2.2
- idf = ln(1 + (N - n + 0.5) / (n + 0.5)) = ln 1.6 = 0.47000363
  - n = 2 ：含有该词语文档的个数
  - N = 3： 含有这个字段的文档总数（包括曾经被索引过的文档数）
- tf = freq / (freq + k1 * (1 - b + b * dl / avgdl)) = 0.44386417
  - freq = 1：在文档中出现的次数
  - k1 * (1 - b + b * dl / avgdl) = dl / avgdl：文档长度变量，文档长度越长，更加相关。
    b、k1 都是常参数，dl 是指该文档的字段长度 ，avgdl 指的是平均文档字段长度。

climbing in 0:

- boost = 2.2

- idf = ln(1 + (N - n + 0.5) / (n + 0.5)) = ln 2.66 = 0.98082924
  n = 1 ：含有该词语文档的个数
  N = 3： 含有这个字段的文档总数（包括曾经被索引过的文档数）
- tf = 0.44386417

最终计算出的相关性分 = 2.2 * 0.47000363 * 0.44386417 + 2.2 * 0.98082924 * 0.44386417 = 1.4167401