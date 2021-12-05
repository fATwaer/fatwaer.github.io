---
title: "google benchmark：利用 perf 工具查看程序热点"
date: 2021-04-30T13:09:26+08:00
draft: false
categories:
  - sys
---

# 前言

准确的度量系统的开销是很重要的, 系统级别比较出名的是 [*Latency Numbers Every Programmer Should Know*](https://gist.github.com/jboner), 而在各种变成语言中, 需要依赖基准测试来判断程序实际的耗时。

```
Latency Comparison Numbers (~2012)
----------------------------------
L1 cache reference                           0.5 ns
Branch mispredict                            5   ns
L2 cache reference                           7   ns                      14x L1 cache
Mutex lock/unlock                           25   ns
Main memory reference                      100   ns                      20x L2 cache, 200x L1 cache
Compress 1K bytes with Zippy             3,000   ns        3 us
Send 1K bytes over 1 Gbps network       10,000   ns       10 us
Read 4K randomly from SSD*             150,000   ns      150 us          ~1GB/sec SSD
Read 1 MB sequentially from memory     250,000   ns      250 us
Round trip within same datacenter      500,000   ns      500 us
Read 1 MB sequentially from SSD*     1,000,000   ns    1,000 us    1 ms  ~1GB/sec SSD, 4X memory
Disk seek                           10,000,000   ns   10,000 us   10 ms  20x datacenter roundtrip
Read 1 MB sequentially from disk    20,000,000   ns   20,000 us   20 ms  80x memory, 20X SSD
Send packet CA->Netherlands->CA    150,000,000   ns  150,000 us  150 ms

Notes
-----
1 ns = 10^-9 seconds
1 us = 10^-6 seconds = 1,000 ns
1 ms = 10^-3 seconds = 1,000 us = 1,000,000 ns

Credit
------
By Jeff Dean:               http://research.google.com/people/jeff/
Originally by Peter Norvig: http://norvig.com/21-days.html#answers

Contributions
-------------
'Humanized' comparison:  https://gist.github.com/hellerbarde/2843375
Visual comparison chart: http://i.imgur.com/k0t1e.png
```

# 基准测试

在CPP中可以依赖 [goolge benchmark]() 来完成这样的事情，安装和编译非常简单，按照文档给出的命令可以很快部署并且开始使用。

```
$ git clone https://github.com/google/benchmark.git
# Benchmark requires Google Test as a dependency. Add the source tree as a subdirectory.
$ git clone https://github.com/google/googletest.git benchmark/googletest
# Go to the library root directory
$ cd benchmark
# Make a build directory to place the build output.
$ cmake -E make_directory "build"
# Generate build system files with cmake.
$ cmake -E chdir "build" cmake -DCMAKE_BUILD_TYPE=Release ../
# or, starting with CMake 3.13, use a simpler form:
# cmake -DCMAKE_BUILD_TYPE=Release -S . -B "build"
# Build the library.
$ cmake --build "build" --config Release
```

然后进行安装

```
sudo cmake --build "build" --config Release --target install
```

## 开始一个简单的测试

``` c++
// bench.cc

#include <benchmark/benchmark.h>
#include <vector>

static void BM_create(benchmark::State& state) {
  // Perform setup here
  for (auto _ : state) {
    // This code gets timed
    std::vector<int> vec;
    (void)vec;
  }
}

static void BM_push_back(benchmark::State& state) {
  // Perform setup here
  for (auto _ : state) {
    // This code gets timed
    std::vector<int> vec;
    vec.push_back(1);
  }
}

static void BM_reserve(benchmark::State& state) {
  // Perform setup here
  for (auto _ : state) {
    // This code gets timed
    std::vector<int> vec;
    vec.reserve(1);
    vec.push_back(1);
  }
}

// Register the function as a benchmark
BENCHMARK(BM_create);
BENCHMARK(BM_push_back);
BENCHMARK(BM_reserve);
// Run the benchmark
BENCHMARK_MAIN();
```

编译、链接并且运行：

```
g++ bench.cc -std=c++11 -g -lbenchmark -lpthread -o bench && ./bench
```

可以看到一个清晰的耗时测试结果：

![输出结果](/images/cpp/output.png)