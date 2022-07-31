---
title: 线程同步
categories:
  - sys
date: 2018-10-15 08:36:39
tags:
---

这篇文章是针对APUE习题11-2的writeup，进程在开启线程后，不同线程需要完成不同的工作，然后在运行中可能引用同一个元素，举一个例子，当多个线程创建后，需要从消息队列中获取一个作业信息的结构体来部署作业工作，但是可能出现第一个线程获取到一个作业之后，在将此作业从作业队列中删除之前，另外一个线程获取了这个作业，然后同样从队列中删除这个作业的操作，那么这个作业就会被删除两次，在C中通常是用链表实现，往往这样做的结果就是指针访问不存在的对象，引发段错误，从而发生非同步性的修改。

![thread](/images/apue/c11/threadop.png)

在完成这道题目之前，先对结构体做一些简单的修改，新增两个元素，作业函数指针和要进行累加的数字。

``` C
struct job {
    struct job *j_next;
    struct job *j_prev;
    pthread_t   j_id;
    /** job */
    int (*j_add)(int);
    int         j_num;
};
```
然后写一个简单的作业函数，完成`j_num`的累加工作，已经初始化结构体`job`的作业分配函数，并且将这个作业加入到作业队列中去：

- 累加函数
``` C
int
add(int i)
{
    int sum;

    sum = 0;
    while (i)
        sum += i--;

    return sum;
}
```
- 作业分配

``` C
struct job *
job_alloc(struct queue *qp, int num)
{
    struct job *jp;

    if ((jp = (struct job *)malloc(sizeof(struct job))) == NULL)
        return (NULL);

    jp->j_add = add;
    jp->j_num = num;
    jp->j_id = pthread_self();
    job_insert(qp, jp);

    return (jp);
}
```

然后可以创建一个线程去完成作业分配工作，生成一个待执行的作业队列，虽然在这里使用主线程来创建会更好。

- 开启线程以及队列初始化

``` C
    struct queue qn;
    int err;
    pthread_t tid1, tid2;

    queue_init(&qn);

    setbuf(stdout, NULL);
    err = pthread_create(&tid1, NULL, th_func1, &qn);
    if (err != 0)
        err_exit(err, "thread create error");
    pthread_join(tid1, NULL);
```

- 线程例程

``` C
void *
th_func1(void *arg)
{
    job_alloc((struct queue *)arg, 10);
    job_alloc((struct queue *)arg, 9);
    job_alloc((struct queue *)arg, 8);
    job_alloc((struct queue *)arg, 7);

    return ((void *)0);
}
```

题目中有提到，需要将线程挂起然后修改作业对应的线程ID，之后要继续执行进行验证，在这里先排除信号量，因为信号量是用在多进程同步，异常的一种机制；所以选择条件变量实现线程的唤醒操作，然后定义一个枚举量来判断多线程处于挂起还是运行状态，如果线程发现这个全局枚举量是处于运行状态，从作业队列中用`job_find`找到一个作业，并且使用`job_remove`从作业队列中移除。

- 条件变量和枚举量

``` C
/** thread suspend mutex*/
pthread_cond_t jready = PTHREAD_COND_INITIALIZER;
pthread_mutex_t statmtx = PTHREAD_MUTEX_INITIALIZER;
pthread_barrier_t b;
enum status {
    STOP    = 0,
    RUNNING = 1
};
static enum status t1st = STOP;
```

- 作业线程例程

``` C
void *
th_func2(void *arg)
{
    struct job *jp;
    int sum;

    pthread_mutex_lock(&statmtx);
    while (t1st == STOP) {
        printf("thread %lu is waiting resource..\n", (unsigned long)pthread_self());

        pthread_cond_wait(&jready, &statmtx);

        /** when the pthread recived the signal, it will test the while loop confidion fisrt*/
    }
    printf("thread %lu is going to run\n", (unsigned long)pthread_self());
    pthread_mutex_unlock(&statmtx);



    jp = job_find((struct queue *)arg, pthread_self());
    job_remove((struct queue *)arg, jp);

    /** processing job */
    sum = jp->j_add(jp->j_num);
    printf("thread %lu caculate %d\n", (unsigned long)pthread_self(), sum);

    printf("return = %d, tid = %lu\n", pthread_barrier_wait(&b), (unsigned long)pthread_self());

```

全局枚举量已经将状态设置为了暂停状态，所以线程一进入例程，就将挂起等待条件变量发生改变，恢复函数应该将枚举量提前设置为运行状态，因为当`pthread_cond_wait()`函数在接收到条件变量发生变化时，只是唤醒线程，不能跳出while循环。

- 修改线程ID

``` C
int
modify_tid(struct queue *qp, pthread_t tid1, pthread_t tid2)
{
    struct job *jp;

    pthread_rwlock_wrlock(&qp->q_lock);

    for (jp = qp->q_head; jp != NULL; jp = jp->j_next)
        if (pthread_equal(jp->j_id, tid1))
            break;
    jp->j_id = tid2;

    pthread_rwlock_unlock(&qp->q_lock);

    return 0;
}
```
在线程唤醒之前，将ID修改为tid2指定的数值，让新创建的线程能在工作队列中找到设置好的对应作业。

- 线程恢复

``` C
void
th_resume(void)
{
    if (t1st == STOP) {
        pthread_mutex_lock(&statmtx);
        t1st = RUNNING;
        pthread_cond_broadcast(&jready);
        printf("thread resume signal send..\n");
        pthread_mutex_unlock(&statmtx);
    }
}
```

简单地把状态设置为运行，并且广播条件变量已经发生了改变。

- 多线程创建和恢复运行线程

``` C
    pthread_barrier_init(&b, NULL, 4+1);
    for (int i = 0; i < 4; i++)
    {
        err = pthread_create(&tid2, NULL, th_func2, &qn);
        if (err != 0)
            err_exit(err, "thread create error");

        modify_tid(&qn, tid1, tid2);
    }
    th_resume();
    pthread_barrier_wait(&b);
```
[11-2-preposition.c](https://github.com/fATwaer/APUE/blob/master/c11/ex/11-2-preposition.c)

![线程工作](/images/apue/c11/11-2-1.png)

多个线程按照想象中的情况从作业队列中取出不同的作业，然后从队列中删去通过`job_find()`找到的作业，并且调用登记在结构体中的函数进行累加，最后在`pthread_barrier_wait()`处进行同步。值得注意的是，虽然在这里一共开了4个线程，但是调用`pthread_barrier_init()`进行初始化的时候，将屏障需要等待的线程数设置为5，因为是把主线程也算了进去。还有一个有意思的地方是，总有一个线程在到达屏障的时候返回`-1`，是因为这个值实际上代表的是`PTHREAD_BARRIER_SERIAL_THREAD`宏，说明这个线程来执行多个线程的归并操作。

通过书上给的代码，已经实现了一个多线程处理作业队列的操作，并且修改了暂停线程的ID，使得对应线程能从工作队列中得到作业。那么回到题目问到的问题上，这样会对`job_remove`产生什么影响？试想这样一种情况，当一个线程已经被唤醒了，然后去调用`job_find`函数寻找相应ID的作业，使得线程的工作指针`jp`指向改结构体，但是此时发生了调度或者系统拥塞事件，这时调用了修改之前修改线程id的函数`modify_tid`，使得描述该作业的结构体的线程ID被填写为另外一个线程的线程ID，现在的情况就变成两个线程的工作指针`jp`都指向了同一个结构体，并且准备执行`job_remove`，这时候任意一个线程先执行，后者都会产生段错误（一般是对NULL指针解引用）。现在修改之前代码来模拟这种情况:

[11-2-exception.c](https://github.com/fATwaer/APUE/blob/master/c11/ex/11-2-expt.c)
- 模拟拥塞或者调度
``` C
    jp = job_find((struct queue *)arg, pthread_self());
    sleep(5);
    job_remove((struct queue *)arg, jp);

```

- 修改ID

``` C
    err = pthread_create(&tid1, NULL, th_func1, &qn);
    if (err != 0)
        err_exit(err, "thread create error");
    pthread_join(tid1, NULL);


    err = pthread_create(&tid2, NULL, th_func2, &qn);
    if (err != 0)
        err_exit(err, "thread create error");

    modify_tid(&qn, tid1, tid2);
    th_resume();
    sleep(1);  /** important here*/
    th_suspend();
    err = pthread_create(&tid3, NULL, th_func2, &qn);
    if (err != 0)
        err_exit(err, "thread create error");
    modify_tid(&qn, tid2, tid3);
    th_resume();

    sleep(10);
```

结果和前面所述的情况一样，两次`remove`引发了段错误。

![引发的段错误](/images/apue/c11/11-2-2.png)

根据提示，可以使用引用计数和一个嵌入结构体的互斥量来解决这个问题，在`job_find()`的时候对引用计数进行加一，在`job_remove`的时候检查引用计数，知道引用计数为0才实际从作业队列中移除。

- 修改结构体

``` C
struct job {
    struct job     *j_next;
    struct job     *j_prev;
    pthread_t       j_id;
    /**mutex and reference count*/
    pthread_mutex_t j_mtx;
    int             j_count;
    /** job */
    int (*j_add)(int);
    int             j_num;
};
```

- job_find

``` C
struct job *
job_find(struct queue *qp, pthread_t id)
{
    struct job *jp;

    if (pthread_rwlock_rdlock(&qp->q_lock) != 0)
        return (NULL);

    for (jp = qp->q_head; jp != NULL; jp = jp->j_next)
    {
        printf("head %p now %p \n  |-job_id %lu cur_id %lu\n", qp->q_head, jp, (unsigned long)jp->j_id, (unsigned long)id);
        if (pthread_equal(jp->j_id, id))
        {
            pthread_mutex_lock(&jp->j_mtx);
            jp->j_count++;
            pthread_mutex_unlock(&jp->j_mtx);
            break;
        }

    }

    pthread_rwlock_unlock(&qp->q_lock);
    return (jp);
}
```
- job_remove

``` C
void
job_remove(struct queue *qp, struct job *jp)
{
    pthread_mutex_lock(&jp->j_mtx);
    if (jp->j_count == 1) {
        /** avoid deadlock*/
        pthread_mutex_unlock(&jp->j_mtx);
        pthread_rwlock_wrlock(&qp->q_lock);
        pthread_mutex_lock(&jp->j_mtx);

        if (jp->j_count != 1) {
            jp->j_count--;
            pthread_mutex_unlock(&jp->j_mtx);
            pthread_rwlock_unlock(&qp->q_lock);
        }

        if (jp == qp->q_head) {
            qp->q_head = jp->j_next;
            if (qp->q_tail == jp)
                qp->q_tail = NULL;
            else
                jp->j_next->j_prev = jp->j_prev;
        } else if (jp == qp->q_tail) {
            qp->q_tail = jp->j_prev;
            jp->j_prev->j_next = jp->j_next;
        } else {
            jp->j_prev->j_next = jp->j_next;
            jp->j_next->j_prev = jp->j_prev;
        }
        pthread_mutex_unlock(&jp->j_mtx);
        pthread_rwlock_unlock(&qp->q_lock);
    } else {
        jp->j_count--;
        pthread_mutex_unlock(&jp->j_mtx);
    }
}
```

并且稍微修改下线程的例程，重新检测线程ID是否发生了改变：

``` C
while (1) {
    jp = job_find((struct queue *)arg, pthread_self());
    sleep(5);
    job_remove((struct queue *)arg, jp);

    if (jp->j_id == pthread_self())
        break;
}
```
[11-2.c](https://github.com/fATwaer/APUE/blob/master/c11/ex/11-2.c)

运行结果如下，现在两个线程可以正常的从作业队列中取作业页并且执行工作了，但是这并不是最好调度方式，如果发生了这样的问题，很大程度上是接口没有设计好，应对这样的问题书中也做了提醒，要为结构体的空间留下空位，以便以后进行拓展。

![修复后的结果](/images/apue/c11/11-2-3.png)



