---
title: "hugo 的代码高亮工具 chroma"
date: 2022-07-31T00:26:39+08:00
draft: false
tags:
  - config
categories:
  - env
---

今天在配置语法高亮的时候，发现 hugo 主题并没有自带 hightlight.js 的引用，但是还是存在默认的语法高亮。

F12 发现 html 代码里 `<pre> -> <code>` 这个层级下面还有存在一些其他的元素和 tag，切割了代码 tag 的整体。

如图：
![](https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/20220731005423.png)

后面搜到 hugo 使用了 [Chroma](https://github.com/alecthomas/chroma) 作为基础的高亮工具，在生成 html 的阶段就做好高亮的解析，而不是等到用户请求的时候再执行高亮处理。

配置代码高亮的方法也比较简单，在网站的配置文件中加上 [markup](https://gohugo.io/getting-started/configuration-markup#highlight) 即可。

``` conf
[markup]
  [markup.highlight]
    anchorLineNos = false
    codeFences = true
    guessSyntax = false
    hl_Lines = ''
    hl_inline = false
    lineAnchors = ''
    lineNoStart = 1
    lineNos = false
    lineNumbersInTable = true
    noClasses = true
    noHl = false
    style = 'colorful'
    tabWidth = 2
```

其中 chroma 支持多种 style，具体见 [链接](https://xyproto.github.io/splash/docs/all.html)。