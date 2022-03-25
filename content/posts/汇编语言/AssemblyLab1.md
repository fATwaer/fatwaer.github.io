---
title: 《汇编语言》 Lab1
categories:
  - 汇编语言
tags: 
  - Assembly
date: 2017-11-13 22:05:05
---


``` assembly
assume cs:codesg


codesg segment

	mov ax,2000
	mov ss,ax
	mov sp,0
	add sp,10
	pop ax
	pop bx
	push ax
	push bx
	pop ax
 	pop bx

	move ax,4c00
	int 21

codesg ends

end

```

