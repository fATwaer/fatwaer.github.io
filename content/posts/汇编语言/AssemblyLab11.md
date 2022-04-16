---
title: 《汇编语言》 Lab11
categories:
  - 汇编语言
tags: 
  - Assembly
date: 2017-11-22 22:39:56
draft: true
---


为了循环方便，我们设置**SI**为**-1**
<!--more-->
```asm
mov si,0FFFFh
```
我们数据判断ASCII值的大小，也就是**CX**的大小，通过**CMP**来设置标志位
```asm
   mov ax,97
   cmp cx,ax
   jb s
```
相当于:** cx > 97 ? 继续执行 : 跳转 **
```asm
   mov ax,122
   cmp cx,ax
   ja s
```
相当于:** cx < 122 ? 继续执行 : 跳转 **


全部代码如下:

```asm
assume cs:code

data segment
    db "Beginner's All-purpose Sybolic Instruction Code.",0
data ends




code segment

begin:     mov ax,data
		   mov ds,ax
		   mov si,0FFFFh
		   call letterc
		   
		   mov ax,4c00h
		   int 21h
	   
letterc:   nop
s:		   inc si
		   mov cl,ds:[si]
		   mov ch,0
		   jcxz break
		   
		   mov ax,97
		   cmp cx,ax
		   jb s
		   mov ax,122
		   cmp cx,ax
		   ja s
		   and cx,11011111b
		   mov byte ptr ds:[si],cl
		   loop s

break:     ret


code ends
end begin
```

实验结果如下：

![lab11.png]( /images/assembly/lab11.png)