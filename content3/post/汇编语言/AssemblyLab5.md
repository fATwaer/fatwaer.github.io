---
title: 《汇编语言》 Lab5
categories:
  - 汇编语言
tags: 
  - Assembly
date: 2017-11-13 22:49:40
draft: true
---
根据程序编译连接并用Debug加载、跟踪，然后回答问题。


### (1)
```asm
assume cs:code,ds:data,ss:stack

data segment
	dw 0123h,0456h,0789h,0abch,0defh,0fedh,0cbah,0987h
data ends

stack segment
	dw 0,0,0,0,0,0,0,0
stack ends

code segment

start: mov ax,stack
	   mov ss,ax
	   mov sp,10h
	   
	   mov ax,data
	   mov ds,ax
	   
	   push ds:[0]
	   push ds:[2]
	   pop  ds:[2]
	   pop	ds:[0]
	   
	   mov ax,4c00h
	   int 21h
	   
code ends


end start
```

CS=0B4A;SS=0B49;DS=0B4B

### (2)
```asm
assume cs:code,ds:data,ss:stack

data segment
	dw 0123h,0456h
data ends

stack segment
	dw 0,0
stack ends

code segment

start: mov ax,stack
	   mov ss,ax
	   mov sp,10h
	   
	   mov ax,data
	   mov ds,ax
	   
	   push ds:[0]
	   push ds:[2]
	   pop  ds:[2]
	   pop	ds:[0]
	   
	   mov ax,4c00h
	   int 21h
	   
code ends


end start
```
CS=0B4A;SS=0B49;DS=0B48


### (3)
```asm
assume cs:code,ds:data,ss:stack

code segment

start: mov ax,stack
	   mov ss,ax
	   mov sp,10h
	   
	   mov ax,data
	   mov ds,ax
	   
	   push ds:[0]
	   push ds:[2]
	   pop  ds:[2]
	   pop	ds:[0]
	   
	   mov ax,4c00h
	   int 21h
	   
code ends

data segment
	dw 0123h,0456h
data ends

stack segment
	dw 0,0
stack ends


end start
```
CS=0B48;SS=0B4C;DS=0B4B

### (4)
#### 如果将(1)(2)(3)题目中最后一条伪指令“end start”改为“end”，则哪个程序可以正确执行？请说明原因。
  
(1)(2)可以，end是告诉编译器在此结束了代码的声明。

### (5)
```asm
assume cs:code

a segment
	db 1,2,3,4,5,6,7,8
a ends

b segment
	db 1,2,3,4,5,6,7,8
b ends

c segment
	db 0,0,0,0,0,0,0,0
c ends

code segment

start:
		mov bx,0
		mov cx,8
		
    s1:	mov ax,a
		mov ds,ax				
		mov dl,[bx]	
		mov ax,c
		mov ds,ax		
		mov [bx],dl
		inc bx
		loop s1	

		mov bx,0 
	s2: mov ax,a
		mov ds,ax		
		mov dl,[bx]		
		mov ax,c
		mov ds,ax		
		add [bx],dl
		inc bx
		loop s2
		
		
	
		mov ax,4c00h
		int 21h
code ends

end start
```
先将数据段a中的数据传送，再累加b数据段的数据，完成运算
