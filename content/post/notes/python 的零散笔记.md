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