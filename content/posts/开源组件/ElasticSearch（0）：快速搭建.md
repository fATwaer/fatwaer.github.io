---
title: "ElasticSearch（0）：快速搭建"
date: 2021-07-08T22:37:19+08:00
Summary: 包括 Elasticsearch 的CRUD和基础检索方式
draft: false
categories:
  - notes
---
### docker-compose.yml
```
version: '2.2'
services:
  node01:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.11.1
    container_name: node01
    environment:
      - node.name=node01
      - cluster.name=es-cluster-7
      - discovery.seed_hosts=node01,node02,node03
      - cluster.initial_master_nodes=node01,node02,node03
      - "ES_JAVA_OPTS=-Xms128m -Xmx128m"
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - es-data01:/usr/share/elasticsearch/data
    ports:
      - 9200:9200
      - 9300:9300
    networks:
      - es-network

  node02:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.11.1
    container_name: node02
    environment:
      - node.name=node02
      - cluster.name=es-cluster-7
      - discovery.seed_hosts=node01,node02,node03
      - cluster.initial_master_nodes=node01,node02,node03
      - "ES_JAVA_OPTS=-Xms128m -Xmx128m"
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - es-data02:/usr/share/elasticsearch/data
    ports:
      - 9201:9201
      - 9301:9301
    networks:
      - es-network

  node03:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.11.1
    container_name: node03
    environment:
      - node.name=node03
      - cluster.name=es-cluster-7
      - discovery.seed_hosts=node01,node02,node03
      - cluster.initial_master_nodes=node01,node02,node03
      - "ES_JAVA_OPTS=-Xms128m -Xmx128m"
    ulimits:
      memlock:
        soft: -1
        hard: -1
    volumes:
      - es-data03:/usr/share/elasticsearch/data
    ports:
      - 9202:9202
      - 9302:9302
    networks:
      - es-network

  kibana:
    image: docker.elastic.co/kibana/kibana:7.11.1
    environment:
      ELASTICSEARCH_HOSTS: http://node01:9200
    ports:
      - 5601:5601
    networks:
      - es-network
    depends_on:
      - node01

volumes:
  es-data01:
    driver: local
  es-data02:
    driver: local
  es-data03:
    driver: local

networks:
  es-network:
    driver: bridge
```

来源于：
https://quoeamaster.medium.com/deploying-elasticsearch-and-kibana-with-docker-86a4ac78d851

https://www.elastic.co/guide/en/elastic-stack-get-started/current/get-started-docker.html
https://doc.yonyoucloud.com/doc/mastering-elasticsearch/chapter-4/46_README.html

### 启动和检查

```
# 启动
sudo docker-compose up
# 集群监控
curl pwaer.ink:9200/_cat/health
=> 1627449664 05:21:04 es-cluster-7 green 3 3 12 6 0 0 0 0 - 100.0%
# 数据和索引文件挂载位置
/usr/share/elasticsearch/data
```


