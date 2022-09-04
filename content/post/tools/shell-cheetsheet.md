---
title: "Shell Cheetsheet"
date: 2020-08-26T20:48:52+08:00
draft: false
thumbnail: "https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/hacker-typer.jpeg"
---


## rsync

``` bash
rsync -av --include="*.cc" \
        --include="*.h" \
        --include="*.proto" \
        --include="*/" \
        --exclude="*" \
        --progress \
        root@address:~/src/ dst/
```

将 `src` 同步到 `dst` 目录下:

- `--include`：同步白名单
- `--exclude`：同步黑名单
- `--progress`：显示进度

