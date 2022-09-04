---
title: "Python 的零散笔记"
date: 2022-07-31T21:24:34+08:00
draft: true
---

## pythonic 的实现



实现 class 的特殊方法 `__getitem__(self, posistion)` 和 `__len__(self)` 就能让一个 class 支持 subscript、slice、iter 这些操作。

如果对一个未实现 `__contains__(self, value)` 的类执行 `in` 操作，将会根据 `len()` 遍历整个 class。

其他的特殊方法还有 `__add__(self, other)` 用于两个类的相加；`__repr__(self)` 类的字符串表示。

https://yangfangs.github.io/2017/08/23/python-map-zip-filter-reduce/

## list

### 列表推导表达式

1、要注意超过多行最好用 for 循环改写

### 笛卡尔积

``` python

color = ['black', 'white', 'blue']
num = [10, 2]
size = ['s', 'm', 'l']

r = [(c, n, s) for c in color
               for n in num
               for s in size]
r

[('black', 10, 's'),
 ('black', 10, 'm'),
 ('black', 10, 'l'),
  ...
 ('blue', 2, 'm'),
 ('blue', 2, 'l')]
```

### 生成器表达式

笛卡尔积会产生一个 `len(color) * len(num) * len(size)` 大小的 list 到内存中，
如果使用生成器就能解决这个问题，生成器表达式和列表推导表达式的区别在于前者是圆括号，后者是方括号。

如下：

``` python
g = ((c, n, s) for c in color
               for n in num
               for s in size)

for i in range(5):
    print(next(g))
```

