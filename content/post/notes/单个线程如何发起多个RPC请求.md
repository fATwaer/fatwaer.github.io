---
title: "gRPC：复用CompletionQueue"
date: 2020-10-19T22:56:03+08:00
draft: false
categories:
  - sys
---

## 异步请求过程

在利用异步gRPC实现请求的时候，通常使用gRPC example中的`greeter_async_client2.cc`作为模板发起异步请求，并通过`CompletionQueue`中的Next()阻塞机制等待请求的完成。

异步请求流程应该如下：

![请求流程](/images/program/grpc.png)

在`greeter_async_client2.cc`中，每一个请求都会创建一个`AsyncClientCall`，并且根据这个new出来的对象地址，作为唯一标识，存储在CompletionQueue中，

``` c++
    // struct for keeping state and data information
    struct AsyncClientCall {
        // Container for the data we expect from the server.
        HelloReply reply;

        // Context for the client. It could be used to convey extra information to
        // the server and/or tweak certain RPC behaviors.
        ClientContext context;

        // Storage for the status of the RPC upon completion.
        Status status;


        std::unique_ptr<ClientAsyncResponseReader<HelloReply>> response_reader;
    };
    void SayHello(const std::string& user) {
        // Data we are sending to the server.
        HelloRequest request;
        request.set_name(user);

        // Call object to store rpc data
        AsyncClientCall* call = new AsyncClientCall;

        // stub_->PrepareAsyncSayHello() creates an RPC object, returning
        // an instance to store in "call" but does not actually start the RPC
        // Because we are using the asynchronous API, we need to hold on to
        // the "call" instance in order to get updates on the ongoing RPC.
        call->response_reader =
            stub_->PrepareAsyncSayHello(&call->context, request, &cq_);

        // StartCall initiates the RPC call
        call->response_reader->StartCall();

        // Request that, upon completion of the RPC, "reply" be updated with the
        // server's response; "status" with the indication of whether the operation
        // was successful. Tag the request with the memory address of the call object.
        call->response_reader->Finish(&call->reply, &call->status, (void*)call);

    }
```

在官方的例子中，客户端启动了一个线程专门去处理数据异步的接收，但是能同步完成，即在发送完后
直接利用`cq.Next()`等待请求的完成。


## 为什么需要复用一个CompletionQueue

假设目前有个线程正在执行一个操作，并且需要调用多个不同的gRPC服务获取数据，如果使用同步的调用，
那么就需要经过多次调用的时间才能完成数据的获取。
```

...
↓
call A  -->t1--> gRPC Server A
↓
call B  -->t2--> gRPC Server B
↓
call C  -->t3--> gRPC Server C
↓
...
```
完成三次数据取的时间就是 t1 + t2 + t3，换成官方的example中的aync_client中的异步调用，收到请求需要CompletetionQueue的Next()调用来同步，处理收到的请求。因为要发起不同的RPC请求，容易惯性地开启多个CompletetionQueue来发起请求，最终等待的时候就会需要多个Next()进行同步，从而不得不开启另一个线程检查
多个CompletetionQueue是否完成，或者单线调用多次Next()导致使用的时间和同步调用没有差别。

如果使用同一个CompletetionQueue发送请求，那么就可以使用一个Next()等待多个请求同步，所使用的时间就是
Max(t1, t2, t3)。使用同一个CompletetionQueue会产生一个问题，Next()等待收到响应后，如何分发到不同的
响应处理中去就成了一个新的问题，最简单的方法之一就是在CompletetionQueue的tag值上想方法，类似于greeter_async_client2.cc中的AsyncClientCall，将结构体的地址写入CQ中，然后在Next()返回得到tag值时
转型成AsyncClientCall类型。在这个结构体中，加入一个类似于type的字段，用于判断请求的类型，就能区分收到的响应是哪个gRPC请求对应的响应。


## 简单例子

### Protobuffer 协议文件

`grpc/examples/protos/helloworld.proto`

``` proto
syntax = "proto3";

option java_multiple_files = true;
option java_package = "io.grpc.examples.helloworld";
option java_outer_classname = "HelloWorldProto";
option objc_class_prefix = "HLW";

package helloworld;

// The greeting service definition.
service Greeter {
  // Sends a greeting
  rpc SayHello (HelloRequest) returns (HelloReply) {}
}

// The request message containing the user's name.
message HelloRequest {
  string name = 1;
}

// The response message containing the greetings
message HelloReply {
  string message = 1;
}


service PingPongService {
  rpc PingPong (PingRequest) returns (PongReply) {}
}

message PingRequest {
  string seq = 1;
}

message PongReply {
  string seq = 1;
}
```

### server.cc

``` cpp
#include <iostream>
#include <memory>
#include <string>
#include <thread>

#include <grpcpp/grpcpp.h>
#include <grpcpp/health_check_service_interface.h>
#include <grpcpp/ext/proto_server_reflection_plugin.h>

#ifdef BAZEL_BUILD
#include "examples/protos/helloworld.grpc.pb.h"
#else
#include "helloworld.grpc.pb.h"
#endif

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;
using helloworld::HelloRequest;
using helloworld::HelloReply;
using helloworld::Greeter;
using helloworld::PingPongService;
using helloworld::PingRequest;
using helloworld::PongReply;

// Logic and data behind the server's behavior.
class GreeterServiceImpl final : public Greeter::Service {
  Status SayHello(ServerContext* context, const HelloRequest* request,
                  HelloReply* reply) override {
    std::cout << request->name() << std::endl;
    reply->set_message("world");
    return Status::OK;
  }
};

class PingPongServiceImpl final : public PingPongService::Service {
  Status PingPong(ServerContext* context, const PingRequest* request,
                  PongReply* reply) override {
    std::cout << request->seq() << std::endl;
    reply->set_seq("pong");
    return Status::OK;
  }
};

void RunServer() {
  std::string server_address("0.0.0.0:50051");
  GreeterServiceImpl service;

  grpc::EnableDefaultHealthCheckService(true);
  grpc::reflection::InitProtoReflectionServerBuilderPlugin();
  ServerBuilder builder;
  // Listen on the given address without any authentication mechanism.
  builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
  // Register "service" as the instance through which we'll communicate with
  // clients. In this case it corresponds to an *synchronous* service.
  builder.RegisterService(&service);
  // Finally assemble the server.
  std::unique_ptr<Server> server(builder.BuildAndStart());
  std::cout << "Server listening on " << server_address << std::endl;

  // Wait for the server to shutdown. Note that some other thread must be
  // responsible for shutting down the server for this call to ever return.
  server->Wait();
}

void RunPingPongServer() {
  std::string server_address("0.0.0.0:50052");
  PingPongServiceImpl service;

  grpc::EnableDefaultHealthCheckService(true);
  grpc::reflection::InitProtoReflectionServerBuilderPlugin();
  ServerBuilder builder;
  // Listen on the given address without any authentication mechanism.
  builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
  // Register "service" as the instance through which we'll communicate with
  // clients. In this case it corresponds to an *synchronous* service.
  builder.RegisterService(&service);
  // Finally assemble the server.
  std::unique_ptr<Server> server(builder.BuildAndStart());
  std::cout << "Server listening on " << server_address << std::endl;

  // Wait for the server to shutdown. Note that some other thread must be
  // responsible for shutting down the server for this call to ever return.
  server->Wait();
}


int main(int argc, char** argv) {
  std::thread t1 = std::thread(RunServer);
  std::thread t2 = std::thread(RunPingPongServer);
  t1.join();
  t2.join();
  return 0;
}

```


### async_client.cc

``` cpp
#include <iostream>
#include <memory>
#include <string>

#include <grpcpp/grpcpp.h>
#include <grpc/support/log.h>
#include <thread>

#ifdef BAZEL_BUILD
#include "examples/protos/helloworld.grpc.pb.h"
#else
#include "helloworld.grpc.pb.h"
#endif

using grpc::Channel;
using grpc::ClientAsyncResponseReader;
using grpc::ClientContext;
using grpc::CompletionQueue;
using grpc::Status;
using helloworld::PingRequest;
using helloworld::PongReply;
using helloworld::PingPongService;
using helloworld::HelloRequest;
using helloworld::HelloReply;
using helloworld::Greeter;

struct AsyncClientCall {
    int type;
    PongReply pong_reply;
    HelloReply hello_reply;
    ClientContext context;
    Status status;
    std::unique_ptr<ClientAsyncResponseReader<PongReply>> pingpong_reader;
    std::unique_ptr<ClientAsyncResponseReader<HelloReply>> greeter_reader;
};

class PingPongClient {
  public:
    explicit PingPongClient(std::shared_ptr<Channel> channel, CompletionQueue *cq)
            : stub_(PingPongService::NewStub(channel)), cq_(cq) {}
    void PingPong(const std::string& seq) {
        PingRequest request;
        request.set_seq(seq);
        AsyncClientCall* call = new AsyncClientCall;
        call->type = 1;
        call->pingpong_reader = stub_->PrepareAsyncPingPong(&call->context, request, cq_);
        call->pingpong_reader->StartCall();
        call->pingpong_reader->Finish(&call->pong_reply, &call->status, (void*)call);
        std::cout << "pingpong call struct address:" << call << std::endl;

    }
  private:
    std::unique_ptr<PingPongService::Stub> stub_;
    CompletionQueue *cq_;
};

class GreeterClient {
  public:
    explicit GreeterClient(std::shared_ptr<Channel> channel, CompletionQueue *cq)
            : stub_(Greeter::NewStub(channel)), cq_(cq) {}
    void SayHello(const std::string& user) {
        HelloRequest request;
        request.set_name(user);
        AsyncClientCall* call = new AsyncClientCall;
        call->type = 0;
        call->greeter_reader = stub_->PrepareAsyncSayHello(&call->context, request, cq_);
        call->greeter_reader->StartCall();
        call->greeter_reader->Finish(&call->hello_reply, &call->status, (void*)call);
        std::cout << "greeter call struct address:" << call << std::endl;
    }
  private:
    std::unique_ptr<Greeter::Stub> stub_;
    CompletionQueue *cq_;
};

void AsyncCompleteRpc(CompletionQueue& cq_) {
    void* got_tag;
    bool ok = false;
    while (cq_.Next(&got_tag, &ok)) {
        AsyncClientCall* call = static_cast<AsyncClientCall*>(got_tag);
        if (call->status.ok())
            if (call->type == 0) {
                std::cout << "address=" << call << " received: " << call->hello_reply.message() << std::endl;
            } else {
                std::cout << "address=" << call << " received: " << call->pong_reply.seq() << std::endl;
            }
        else
            std::cout << "RPC failed" << std::endl;
        delete call;
    }
}

int main(int argc, char** argv) {

    CompletionQueue cq;

    GreeterClient greeter(grpc::CreateChannel(
            "localhost:50051", grpc::InsecureChannelCredentials()), &cq);
    PingPongClient client(grpc::CreateChannel(
            "localhost:50052", grpc::InsecureChannelCredentials()), &cq);

    greeter.SayHello("hello");
    client.PingPong("ping");
    AsyncCompleteRpc(cq);

    return 0;
}
```


### 运行结果

``` bash
>> ./server
Server listening on 0.0.0.0:50052
Server listening on 0.0.0.0:50051

----

>> ./async_client
greeter call struct address:0x1748eb0
pingpong call struct address:0x174e410
address=0x1748eb0 received: world
address=0x174e410 received: pong
```