---
title: "Python Gist"
date: 2020-08-26T20:48:45+08:00
draft: false
summary: python 工具代码片段（人生苦短）
thumbnail: "https://blog-1256435232.cos.ap-shanghai.myqcloud.com/cnblog/cpp.vs.python.jpeg"
---


## logging

``` python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s,%(msecs)d %(levelname)-8s [%(filename)s:%(lineno)d] %(message)s",
    datefmt="%Y-%m-%d:%H:%M:%S",
    handlers=[
        logging.FileHandler("debug.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
```

按照 `logging.DEBUG` 作为最低日志输出级别，并且将日志输出到标准输出 stdout 和日志文件 `debug.log` 中

## exception

``` python
import traceback
try:
    do_somthing_a()
    do_somthing_b()
    do_somthing_c()
except Exception as e:
    traceback.print_tb(e.__traceback__)
```

## md5sum

``` python3
def md5sum(filename):
    with open(filename, mode='rb') as f:
        d = hashlib.md5()
        for buf in iter(partial(f.read, 128), b''):
            d.update(buf)
    return d.hexdigest()

```

## timestamp

``` python
def timestamp():
    return time.strftime("%Y%m%d%H%M%S", time.localtime())
```

## shutil(shell util)

``` python
import shutil
shutil.move(src, dst)
```

## subprocess

### 子进程实时输出

``` python
import subprocess

cmd = f"vmstat 1 20"
with subprocess.Popen(cmd.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE) as proc:
    for line in iter(proc.stdout.readline, b''):
        print(">>> " + line.rstrip().decode())
    proc.wait()
```