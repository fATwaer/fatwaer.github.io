---
title: 'static,extern关键词和函数指针数组'
categories:
  - language
date: 2018-04-19 23:49:06
tags:
- c/c++
---


## extern

从该文件外部获取变量定义，在文件域默认有extern属性。存储属性为static，也就是在文件执行前就被放在静态数据区。

## static

只在该文件域可以使用，存储属性为static。

## 实例

extern.c
``` C
#include <stdio.h>

int k = 10;
extern void print(void);

int
main()
{
    printf("k: %d\n", k);
    print();
}
```

extern2.c
``` C
#include <stdio.h>


void print(void)
{
    extern int k;
    printf("extern int k: %d\n", k);
}
```
shell

    $ gcc -o ex extern.c extern2.c
    $ ./ex


## 函数指针数组

``` C
#include <stdio.h>

static int
print1(void)
{
    printf("function: print1()\n");
}

static int
print2(void)
{
    printf("function: print2()\n");
}


static int (*arr[])(void) = {
[0] print1,
[1] print2,
};

int (* foo)(void);

int
main(void)
{
    foo = arr[0];
    foo();
}
```

__static int (*arr[])(void)__可以理解为arr[]数组中存有两个类型为__static int(void)__的函数指针


---

static关键词可以设计__抽象数据类型ADT(abstract data type)__黑盒。

可以设计一个这样的头文件作为接口：
`list.h`

``` C
/*
**
**  headfile for ADT
**
*/

/* macro */
#define NAME_LEN 30
#define ADDR_LEN 100
#define PHONE_LEN 11

#define MAX_ADDRESSES 1000

/* interface declaration */
char const *
lookup_address(char const *name);

char const *
lookup_phone(char const *name);

```

---
`list.c`
``` C
#include <stdio.h>
#include <string.h>
#include "list.h"


/* static data type*/
static char name[MAX_ADDRESSES][NAME_LEN];
static char address[MAX_ADDRESSES][ADDR_LEN];
static char phone[MAX_ADDRESSES][PHONE_LEN];

static int
find_entry(const char *name2find)
{
    int entry;

    for (entry = 0; entry < MAX_ADDRESSES; entry += 1)
        if(strcmp(name2find, name[entry]) == 0)
            return entry;

    return -1;
}


const char *
lookup_address(const char *name)
{
    int entry;

    entry = find_entry(name);
    if(entry == -1)
        return NULL;
    else
        return address[entry];
}

const char *
lookup_phone(const char *name)
{
    //  ...
    //  ...
    //  implement
    //  ...
    //  ...
}
```

这样调用接口就能获得数据，但是不能直接得到数据，有点像OOP编程的思想。当然，直接用数组作为数据存储的容器，这儿只是一个例子，改变自《pointers on c》。