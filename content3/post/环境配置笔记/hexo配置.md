---
title: "hexo 配置"
tags:
  - config
date: 2018-04-05 15:17:47
categories:
  - env
---

**注**： 博客已经从hexo迁移到了hugo，部分格式已经不能渲染出来。

## categories和tags
themes文件夹下面的_config.yml有一个memu选项，hiker是默认有归档选项的。但是分类和标签是空页面，本地访问会提示 GET ERROR 的404错误。在md文件有表示的情况下，像如下配置即可。

``` bash
type: "categories"
layout: "categories"
comments: false
```

``` bash
type: "tags"
layout: "tags"
comments: false
```

<!--more-->

## hexo-auto-category插件
在_post文件夹下面创建的文件夹，都会被当作一个category，并分别将各个文件夹下面的md文件自动加上相应的category标识。
安装
`$ npm install hexo-auto-category --save`

`$ hexo clean && hexo g && hexo s`


_config.yml配置
```
# Generate categories from directory-tree
# Dependencies: https://github.com/xu-song/hexo-auto-category
# depth: the depth of directory-tree you want to generate, should > 0
auto_category:
 enable: true
 depth:
```

github网址: https://github.com/xu-song/hexo-auto-category

## live-2d
这是个非常有趣的插件，看板娘get！
安装:

`$ npm install --save hexo-helper-live2d`

根据[原github](https://github.com/EYHN/hexo-helper-live2d),修改hexo文件夹下面的_config.yml。
然后要安装相应的模组：

`$ npm install {your model's package name}`
模组下载地址:https://github.com/xiazeyu/live2d-widget-models

## hexo-helper-qrcode
二维码

Install
`$ npm i -S hexo-helper-qrcode`

Usage
``` HTML
<img src="<%- qrcode(url) %>">

<!-- white margin, default 0 -->
<img src="<%- qrcode(url, {
    margin: 2
}) %>">

<!-- size of one module in pixels, default 6 -->
<img src="<%- qrcode(url, {
    size: 4
}) %>">
```


## fontawesome
在md文档中加入矢量图

`<i class="fa fa-twitter fa-2x"></i>` ~~hugo 不支持~~

 <i class="fa fa-caret-right"></i>fontwawesome : http://www.bootcss.com/p/font-awesome/design.html


## hexo-githus

    $ npm install --save hexo-githus

    {% github name repo commit-sha-1 [auto_expand = true | false] [width = 50%] %}

{% github fatwaer APUE-Practice-Code 6fb648e42bc1229199b80f1aba04280f9e5ad271  [width = 50%] %}

## hexo-sliding-spoiler

`shell`

    $ npm install hexo-sliding-spoiler --save

`__config.yml`
```
plugins:
 - hexo-sliding-spoiler
```

`markdown`
``` CSS
{% spoiler title %}
content
{% endspoiler %}
```

{% spoiler title %}
`code test`

    int
    main()
    {
        return 0;
    }


__test bold__
{% endspoiler %}