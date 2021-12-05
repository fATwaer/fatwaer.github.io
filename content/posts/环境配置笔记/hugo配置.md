---
title: "Hugo is comming !"
date: 2019-09-18T14:11:14+08:00
draft: false
tags:
  - config
categories:
  - env
---

> 将博客从 hexo 迁到了 hugo，主要原因是文章越来越多，hexo build速度就显得力不从心了，hexo 很多主题都不再维护，甚至很少有新的主题发布出来，而 hugo 相反，随着golang热度的上涨，社区也很活跃，其主题的更新在官网可以看出来相对频繁。我目前使用的主题是由[zzossig](https://github.com/zzossig) 提供的[Zzo](https://github.com/zzossig/hugo-theme-zzo)主题。

## Hugo 总览

看到比较合适的主题，有需要自己定制的话，可以简单过一遍Hugo的一个官方教程(大概3-4小时)：

 > https://www.youtube.com/watch?v=qtIqKaDlqXo&list=PLLAZ4kZ9dFpOnyRlyS-liKL5ReHDcj4G3




### Hugo 的安装和环境配置
  Hugo 提供了较为详细的[官方教程](https://gohugo.io/getting-started/quick-start/)，安装过程非常详细，如果是在windows上安装，可以下载[二进制文件](https://github.com/gohugoio/hugo/releases)到任意目录下，并且将改目录添加到`PATH`环境变量即可。

### Hugo 的基本使用

将hugo的环境搭建完成后博客根目录进行初始化：

``` bash
hugo version
mkdir Sites
cd Sites
hugo new site sitename
```

然后需要去主题页找一个合适的[主题](https://themes.gohugo.io/)，并且下载到`Sites/sitename/themes`目录，或者在`Sites/sitename`目录下执行：

``` bash
git init
git submodule add https://github.com/budparr/gohugo-theme-ananke.git themes/ananke
```

然后将配置文件中的主题设置为下载到`themes`目录中的主题文件夹名字：

``` bash
echo 'theme = "ananke"' >> config.toml
```



像hexo一样，hugo提供了本地预览的功能，在 `Sites/sitename`目录下运行，然后就可以访问`localhost:1313`来访问博客了：

``` bash
$ hugo server
Building sites …
                   | EN  | KO
-------------------+-----+------
  Pages            |  54 |  10
  Paginator pages  |   3 |   0
  Non-page files   |   0 |   0
  Static files     | 209 | 209
  Processed images |   0 |   0
  Aliases          |  11 |   1
  Sitemaps         |   2 |   1
  Cleaned          |   0 |   0

Built in 5641 ms
Environment: "development"
Serving pages from memory
Running in Fast Render Mode. For full rebuilds on change: hugo server --disableFastRender
Web Server is available at //localhost:1313/ (bind address 127.0.0.1)
Press Ctrl+C to stop
```

### Hugo 与 Github

如果单单运行`hugo`并且不添加仍和参数，hugo就会将博客的静态文件全部生成到`sitename/public`内，然后与`githubname.github.io`仓库进行关联，然后将代码推上去，就可以正常访问了。



### 其他
Hugo 静态生成主要由两个部分组成，一个是`list template`，用于生成类似于目录页的页面，另一个是single template，类似于每一篇博客展现内容的页面。这两个页面一般是被嵌入在一个叫`baseof.html`的模板中。

## Markdown 图床

最开始用微博+chrome插件， 后来微博开启了防盗链， 转移到了七牛+picGo
https://www.cnblogs.com/Dozeer/p/10965508.html

