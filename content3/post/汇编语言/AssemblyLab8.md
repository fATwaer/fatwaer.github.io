---
title: 《汇编语言》 Lab8
categories:
  - 汇编语言
tags: 
  - Assembly
date: 2017-11-17 12:15:41
draft: true
---


```asm
assume cs:codesg
codesg segment
	
	mov ax,4c00h
	int 21h
	
start: mov ax,0
    s: nop
	   nop
	   
	   mov di,offset s
	   mov si,offset s2
	   mov ax,cs:[si]
	   mov cs:[di],ax
	   
   s0: jmp short s
   
   s1: mov ax,0
       int 21h
	   mov ax,0
	   
   s2: jmp short s1
	   nop 
	   
	   
codesg ends
end start

```




**其中**
```asm
jmp short s
```
**命令占用两个字节**

![lab8.1](/images/assembly/lab8.1.png)

