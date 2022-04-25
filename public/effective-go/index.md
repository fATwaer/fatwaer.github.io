# Effective Go



## goroutine部分

goroutine的一些tricks，比如

    func Announce(message string, delay time.Duration) {
        go func() {
            time.Sleep(delay)
            fmt.Println(message)
        }()  // 注意括号 - 必须调用该函数。
    }
直接在`go`关键字后面接一个lambada表达式作为例程。

`goroutine`通常和`channal`一起使用，Unix的管道是基于生产-消费者模型，而channal则使用[CSP](https://www.cs.cmu.edu/~crary/819-f09/Hoare78.pdf)(Communicating Sequential Process)进行构建。信道没有数据的时候会进行阻塞，利用这种条件可以实现一些信号量机制。

    var sem = make(chan int, MaxOutstanding)

    func handle(r *Request) {
        sem <- 1 // 等待活动队列清空。
        process(r)  // 可能需要很长时间。
        <-sem    // 完成；使下一个请求可以运行。
    }

    func Serve(queue chan *Request) {
        for {
            req := <-queue
            go handle(req)  // 无需等待 handle 结束。
        }
    }

例如这样一段代码可以实现最大接受请求数量为`MaxOutstanding`,当新的请求到达时，`req := <-queue`从阻塞中恢复并且执行goroutine处理请求，再往sem里面写入内容时，会因为队列满了而阻塞，当然这样也有局限性，当有大量请求到达的时候，会不停地新生成新的goroutine，占用系统资源。


    func Serve(queue chan *Request) {
        for req := range queue {
            req := req // 为该Go程创建 req 的新实例。
            sem <- 1
            go func() {
                process(req)
                <-sem
            }()
        }
    }
解决方案是在循环的routine中尝试往信道中写入内容，这样可以正确实现队列的大小限制。考虑去掉`req := req`这一行，`req`变量在每个循环中都被赋予不同的值，但是实际上底层使用的同样的内存，相应的goroutine后的函数闭包可以引用该作用域的变量并且保持和修改，所以每个新生成的goroutine都会使用同一个变量，造成比较严重的错误。

>Concurrency is about dealing with lots of things at once. Parallelism is about doing lots of things at once.

另外，`并发(concurrency)`和`并行(parallelism)`是两种单独的意思，并发是多个独立地执行程序的组合，即一次性解决大量的事情，而并行是同时执行某些相关连的计算。


## 反射相关

变量的最基本信息就是类型和值：反射包的 Type 用来表示一个 Go 类型，反射包的 Value 为 Go 值提供了反射接口。这对于没有源代码的包尤其有用。这是一个强大的工具，除非真得有必要，否则应当避免使用或小心使用。

实际上，反射是通过检查一个接口的值，变量首先被转换成空接口。这从下面两个函数签名能够很明显的看出来：

    func TypeOf(i interface{}) Type
    func ValueOf(i interface{}) Value
接口的值包含一个 type 和 value。

## 结构体，集合设计

https://go.fdos.me/11.14.html (golang中一些关于结构体的设计技巧)


## 常见错误

[50种常见错误](http://devs.cloudimmunity.com/gotchas-and-common-mistakes-in-go-golang/) (在awesome-go仓库里面翻到的，有空可以看看)

[翻译版本](https://wuyin.io/2018/03/07/50-shades-of-golang-traps-gotchas-mistakes/)

## 并发控制库

[Context库](https://www.flysnow.org/2017/05/12/go-in-action-go-context.html) (该作者其他的帖子也可以看看，干货较多)
