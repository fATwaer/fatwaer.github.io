---
title: 《汇编语言》 Lab10
categories:
  - 汇编语言
tags: 
  - Assembly
date: 2017-11-21 22:41:02
---

实验10 一共3个小实验，分别完成三个函数。


<!--more-->

### 显示字符串

第一个很简单，详细可见**Lab9**

代码如下:

```asm

assume cs:codesg

data segment
	db "welcome to masm!",0
data ends



codesg segment

start: mov dh,8
       mov dl,3
	   mov cl,2
	   mov ax,data
	   mov ds,ax
	   mov si,0
	   call show_str
	   
	   mov ax,4c00h
	   int 21h

show_str:

		mov al,dh
		mov bl,160
		mul bl
		mov bx,ax        ;行数
		mov al,2
		mul dl
		mov di,ax        ;列数       
		mov ax,0B800h
		mov es,ax
		
	s:  mov cl,ds:[si]
		mov ch,0
		jcxz short break
		mov byte ptr es:[bx+di],cl
		mov byte ptr es:[bx+di+1],01110010b
		inc si
		add di,2
		loop s
		
		
		
break:  nop	
		ret
		
		
codesg ends
end start

```

程序编译执行后的结果:

![lab10.1.png]( http://py2h8wxnt.bkt.clouddn.com/assembly/lab10.1.png)


### 解决除法溢出问题

**计算公式:int(H/N)\*65536 + \[rem(H/N)+L\]/N** 
	H:高八位
	L:低八位
	N:除数
	int():取商
	rem():取余


代码如下:

```asm

assume cs:codesg,ss:stack

stack segment
    dw 0
stack ends


codesg segment


start: mov ax,4240h
	   mov dx,000Fh
	   mov cx,0Ah
	   call divdw
	   
	   mov ax,4c00h
	   int 21h

divdw: mov bx,stack
	   mov ss,bx
	   mov sp,2
	   push ax    ;先完成高八位的除法
	   mov ax,dx
	   mov dx,0
	   div cx     ;此时，dx中为余数，ax中为高位的商.
	   
	   pop bx 
	   push ax
	   mov ax,bx  ;ax为低八位的数值，dx为H/N的余数
	   div cx     ;进行16位除法 
	   
	              ;此时，dx最终结果的余数，ax中为低位的商
 	   pop bx
	   mov cx,dx  
	   mov dx,bx
	   
	   ret


codesg ends


end start

```
实验结果如下:
** DX = 0001H , AX = 86A0H , CX = 0 **


![lab10.2.png]( http://py2h8wxnt.bkt.clouddn.com/assembly/lab10.2.png)

### 数据显示


仔细观察下数据12666，在除法操作后，商为1266 > 2^8，所以得进行**16位除法 **

```asm
	mov dx,0
	mov bx,10
	div bx  

```
整除后，**dx为余数，ax中为商**。
因为除10，余数为个位数，用dl的大小可传送数值.
```asm
   add dl,30h 
   mov byte ptr ds:[si],dl 
```
由于进行除法后，余数是顺序存储，所以字符串是逆序的。
字符串尾是ds的开头，开始时，我们需要设置 ** si=1 ** 。

除法的循环不是用的loop指令，而是直接用jmp指令是因为loop指令会对cx操作
而这段代码中，cx是来判断最后的商是否为0。
如果cx被传送的商为1，**loop操作会使cx减1**，此时cx变为0，直接结束了循环操作。



全部代码如下:
```asm
assume cs:code

data segment
    db 10 dup(0)
data ends

code segment

start: mov ax,12666
	   mov bx,data
	   mov ds,bx
	   mov si,1     
	   call dtoc
	   
	   mov dh,8
	   mov dl,3 
	   mov cl,2
	   call show_str
	   
	   mov ax,4c00h
	   int 21h
	   
	   
dtoc:  mov dx,0
	   mov bx,10
sd:	   div bx      ;进行16位除法，dx为余数，ax中为商
	   add dl,30h  ;数字加上30h为ASCII的值
	   mov byte ptr ds:[si],dl       
	   mov cx,ax
	   jcxz short break
	   mov dx,0
	   inc si
       jmp short sd ; 在这使用jmp而不适用loop

break: ret



show_str:

		mov al,dh
		mov bl,160
		mul bl
		mov bx,ax        ;行数
		mov al,2
		mul dl
		mov di,ax        ;列数       
		mov ax,0B800h
		mov es,ax
		mov al,cl
		
   s3:  mov cl,ds:[si]
		jcxz short break2
		mov byte ptr es:[bx+di],cl
		mov byte ptr es:[bx+di+1],al
		sub si,1         ;逆序输出
		add di,2
		loop s3
		
		
		
break2:  nop	
		 ret

code ends


end start
```


如图，测试结果

![lab10.3.png]( http://py2h8wxnt.bkt.clouddn.com/assembly/lab10.3.png)






