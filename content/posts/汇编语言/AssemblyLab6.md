---
title: 《汇编语言》 Lab6
categories:
  - 汇编语言
tags: 
  - Assembly
date: 2017-11-13 23:11:53
---


```asm
datasg segment
	db '1. display      '
	db '2. brows        '
	db '3. replace      '
	db '4. modify       '
datasg ends
```
将数据段前四个字母改为大写字母
&nbsp代码如下:

```asm
assume cs:codesg,ss:stacksg,ds:datasg

stacksg segment
	dw 0,0,0,0,0,0,0,0
stacksg ends

datasg segment
	db '1. display      '
	db '2. brows        '
	db '3. replace      '
	db '4. modify       '
datasg ends

codesg segment

start:  mov ax,stacksg
		mov ss,ax
		mov sp,16
		
		mov ax,datasg
		mov ds,ax
		
		mov cx,4h
		mov bx,0

s1:		push cx
		
		mov cx,4
		
		mov si,0

s2:		mov al,[bx+3+si]
		and al,11011111b
		mov [bx+3+si],al
		inc si
		loop s2
		
		add bx,16
		pop cx
		loop s1
		
		
		mov ax,4c00h
		int 21h
		

codesg ends

end start		
		
```