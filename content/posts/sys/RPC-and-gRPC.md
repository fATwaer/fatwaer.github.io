---
title: Golang原生RPC与gPRC
date: 2020-02-26 22:19:35
tags:
  - distributed system
categories:
  - sys
---


## 前言

因为前段时间把6.824的lab3做完了，但是lab内部是用channel mock了一个简单的网络来测试网络丢包，网络分区等问题，也就是说跑在单机上面，其rpc也是通过channel和反射实现。目前比较有名的RPC框架就是gRPC，golang也自带了rpc库，这篇文章主要讲述这两者的简单使用，以及谈论一些关于rpc的观点。

## RPC历史

RPC也称远程过程调用，自从上世纪70年代就存在的思想，RPC模型是尝试使远程服务看起来像在统一进程空间的函数一样。但是，一种基于HTTP原则的设计理念REST可以扮演RPC的角色，利用url表示资源，利用HTTP的其他功能提供身份验证等，并且RPC虽然看上去非常简洁，实际上是存在缺陷的，比如rpc的时间根据网络情况可能大不相同，网络不可信时，超时重传会使RPC函数被调用多次，这就又需要这个函数能保证**幂等性**等。

虽然有以上问题，RPC没有消失肯定有其独特存在的原因，首先是使用二进制编码的RPC协议能实现比REST上基于JSON的数据流协议获得更好的性能(但是JSON数据流可以提供良好的调试功能，这是二进制编码不可比拟的)。所以REST一般用于公共API，而RPC框架侧重于同一组织内多项服务之间的请求，也通常发生在同一个数据中心。

RPC的目标是让客户端和服务端易于交互(编程意义上)，隐藏底层的网络协议。

## 原生RPC

这里直接尝试写一个简单的KV服务，提供Put，Get的接口。

### 客户端代码

``` Go
package main

import (
        "fmt"
        "log"
        "net/rpc"
)

//
// Common RPC request/reply definitions
//

const (
        OK       = "OK"
        ErrNoKey = "ErrNoKey"
)

type Err string

type PutArgs struct {
        Key   string
        Value string
}

type PutReply struct {
        Err Err
}

type GetArgs struct {
        Key string
}

type GetReply struct {
        Err   Err
        Value string
}

//
// Client
//

func connect() *rpc.Client {
        client, err := rpc.Dial("tcp", "fatwaer.store:1234")
        if err != nil {
                log.Fatal("dialing:", err)
        }
        return client
}

func get(key string) string {
        client := connect()
        args := GetArgs{"subject"}
        reply := GetReply{}
        err := client.Call("KV.Get", &args, &reply)
        if err != nil {
                log.Fatal("error:", err)
        }
        client.Close()
        return reply.Value
}

func put(key string, val string) {
        client := connect()
        args := PutArgs{"subject", "6.824"}
        reply := PutReply{}
        err := client.Call("KV.Put", &args, &reply)
        if err != nil {
                log.Fatal("error:", err)
        }
        client.Close()
}

//
// main
//

func main() {
        put("subject", "6.824")
        fmt.Printf("Put(subject, 6.824) done\n")
        fmt.Printf("get(subject) -> %s\n", get("subject"))
}
```

### 服务端代码

``` go
package main

import (
        "fmt"
        "log"
        "net"
        "net/rpc"
        "sync"
)

//
// Common RPC request/reply definitions
//

const (
        OK       = "OK"
        ErrNoKey = "ErrNoKey"
)

type Err string

type PutArgs struct {
        Key   string
        Value string
}

type PutReply struct {
        Err Err
}

type GetArgs struct {
        Key string
}

type GetReply struct {
        Err   Err
        Value string
}

//
// Server
//

type KV struct {
        mu   sync.Mutex
        data map[string]string
}

func server() {
        kv := new(KV)
        kv.data = map[string]string{}
        rpcs := rpc.NewServer()
        rpcs.Register(kv)
        l, e := net.Listen("tcp", ":1234")
        if e != nil {
                log.Fatal("listen error:", e)
        }
        fmt.Println("server Listen ")
        for {
                conn, err := l.Accept()
                if err == nil {
                        go rpcs.ServeConn(conn)
                } else {
                        break
                }
        }
        l.Close()
}

func (kv *KV) Get(args *GetArgs, reply *GetReply) error {

        fmt.Printf("server recive get %s\n", args.Key)
        kv.mu.Lock()
        defer kv.mu.Unlock()

        val, ok := kv.data[args.Key]
        if ok {
                reply.Err = OK
                reply.Value = val
        } else {
                reply.Err = ErrNoKey
                reply.Value = ""
        }
        return nil
}

func (kv *KV) Put(args *PutArgs, reply *PutReply) error {

        fmt.Printf("server recive put %s->%s\n", args.Key, args.Value)
        kv.mu.Lock()
        defer kv.mu.Unlock()

        kv.data[args.Key] = args.Value
        reply.Err = OK
        return nil
}

//
// main
//

func main() {
        server()
}
```

### 运行结果

分别在两台云服务器上运行，确保可以通过网络传递消息：

![client](/images/distributed-system/rpc/rpcc.png)
![server](/images/distributed-system/rpc/rpcs.png)

### 代码结构

``` code
    Software structure
      client app        handler fns
      stub fns         dispatcher
      RPC lib           RPC lib
        net  ------------ net
```

客户端/服务端需要先建立相应的TCP连接，即服务端先在相应端口绑定监听，然后客户端与该端口三次握手后，服务端accept返回得到建立好的TCP连接，注册到RPC中，然后将数据写入到连接内，服务端收到调用，执行相应的程序返回。

---

## gRPC

gRPC的使用分为三部:

1. 将需要在网络中传递的数据/服务定义在`.proto`里
2. 利用protocol buffer compiler基于上面的`.proto`生成代码
3. 使用gRPC的API

### 安装依赖

- grpc

``` bash
go get google.golang.org/grpc
go get -u github.com/golang/protobuf/protoc-gen-go
export PATH=$PATH:$GOPATH/bin
```

- protocol buffer compiler(protoc)

``` bash
PROTOC_ZIP=protoc-3.7.1-linux-x86_64.zip
curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v3.7.1/$PROTOC_ZIP
sudo unzip -o $PROTOC_ZIP -d /usr/local bin/protoc
sudo unzip -o $PROTOC_ZIP -d /usr/local 'include/*'
rm -f $PROTOC_ZIP
```

### 定义自己的proto

- kv.proto

``` pb
syntax = "proto3";

package kv;

service kv {
    rpc Put (PutArgs) returns (PutReply) {}
    rpc Get (GetArgs) returns (GetReply) {}
}

message PutArgs {
    string key = 1;
    string value = 2;
}

message PutReply {
    string ok = 1;
}

message GetArgs {
    string key = 1;
}

message GetReply {
    string ok = 1;
    string value = 2;
}

```

`syntax`为protobuf编码版本，`message`类似于类型定义关键字，而每一个message内都需要有一个单独的值来指定某个变量。

### 生成 .pb.go

例如如下的代码结构：

``` bash
store : ~/gokv/grpc/src > tree .
.
├── kv
│   ├── kv.proto
store : ~/gokv/grpc/src > echo $GOPATH
/root/go:/root/gokv/grpc
```

执行

``` bash
protoc -I kv/ kv/kv.proto --go_out=plugins=grpc:kv
```

在kv目录下生成kv.pb.go，然后在外部利用import kv即可使用kv.pb.go中生成的代码。
kv.pb.go包含了如下内容：

1. 生成的服务端和客户端的代码
2. 对调用参数进行序列化、反序列化的代码

### 写自己的KV服务

和上面原生RPC的类似：

- 服务端代码

``` go
package main

import (
        "context"
        "log"
        "net"
    "sync"

        "google.golang.org/grpc"
        pb "kv"
)

const (
        port = ":1234"
)

// server is used to implement kv.Kvserver.
type server struct {
    data map[string] string
    mu sync.Mutex
        pb.UnimplementedKvServer
}

// Put implements implement kv.Kvserver
func (s *server) Put(ctx context.Context, in *pb.PutArgs) (*pb.PutReply, error) {
        log.Printf("Received Put: %v", in)
    s.mu.Lock()
    defer s.mu.Unlock()
    s.data[in.Key]  = in.Value
    return &pb.PutReply{Ok: "Ok"}, nil
}

func (s *server) Get(ctx context.Context, in *pb.GetArgs) (*pb.GetReply, error) {
    log.Printf("Received Get: %v", in)
    s.mu.Lock()
    defer s.mu.Unlock()
    value := s.data[in.Key]
    return &pb.GetReply{Ok: "Ok", Value:value}, nil
}

func main() {

    log.Printf("server start\n")
    lis, err := net.Listen("tcp", port)
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }
    rpcs := grpc.NewServer()
    srv := new(server)
    srv.data = map[string]string{}

    pb.RegisterKvServer(rpcs, srv)
    log.Printf("Listen at %s\n", port)
    if err := rpcs.Serve(lis); err != nil {
        log.Fatalf("failed to serve: %v", err)
    }
}
```

- 客户端代码

``` go
package main

import (
        "context"
        "log"
        "time"

        "google.golang.org/grpc"
        pb "kv"
)

const (
        address = "fatwaer.store:1234"
)

func main() {
        // set-up connection.
        conn, err := grpc.Dial(address, grpc.WithInsecure(), grpc.WithBlock())
        if err != nil {
                log.Fatalf("didn't connect: %v", err)
        }
        defer conn.Close()
        c := pb.NewKvClient(conn)
        log.Printf("connect ok")
        ctx, cancel := context.WithTimeout(context.Background(), time.Second)
        defer cancel()
        r, err := c.Put(ctx, &pb.PutArgs{Key: "Hello", Value: "World"})
        if err != nil {
                log.Fatalf("put err %v", err)
        }
        log.Printf("put %s", r.GetOk())

        nr, err := c.Get(ctx, &pb.GetArgs{Key: "Hello"})
        if err != nil {
                log.Fatalf("put err %v", err)
        }
        log.Printf("get %s, get value %s", nr.GetOk(), nr.GetValue())

}
```


### 运行结果

![server](/images/distributed-system/rpc/grpcs.png)
![client](/images/distributed-system/rpc/grpcc.png)

和原生RPC使用很类似，但是中间加了一层protobuf的使用问题，而protobuf的存在却可以解决在多语言之间进行通信的问题，而原生不行。
![landing](/images/distributed-system/rpc/landing-2.svg)

## 参考资料

- 《数据密集型应用系统设计》
- <https://pdos.csail.mit.edu/6.824/notes/kv.go>
- <https://pdos.csail.mit.edu/6.824/notes/l-rpc.txt>
- <https://developers.google.com/protocol-buffers/docs/overview>
- <https://developers.google.com/protocol-buffers/docs/proto>
- <https://grpc.io/docs/tutorials/basic/go/>
- <http://google.github.io/proto-lens/installing-protoc.html>