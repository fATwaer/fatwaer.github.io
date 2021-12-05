---
title: Git 基础操作
categories:
  - 其他
date: 2018-04-17 23:27:42
categories:
  - env
---

# 远程到本地
---

    $ git fetch
    $ git merge origin/master


# 本地到远程
---
__关联__

    git remote add origin git@github.com:haoxr/-faceDetection.git

__提交到本地__

    $ git add .
    $ git commit -m "commit infomation"

__push__

    $ git push -u origin master <- 第一次使用
    $ git push origin master