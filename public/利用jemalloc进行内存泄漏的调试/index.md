# 利用Jemalloc进行内存泄漏的调试


内存不符预期的不断上涨，可能的原因是内存泄漏，例如new出来的对象未进行delete就重新进行复制，使得之前分配的内存块被悬空，应用程序没办法访问到那部分内存，并且也没有办法释放；在C++中，STL容器都会有clear()方法并且伴随RAII原则对容器里元素进行清理，但除了STL还有可能是字符串不断地在进行累加，不断的分配出新的内存块存放增长的字符串。

在[cppzh 群](https://tgram.io/zh/group/2305/cpluspluszh) 内看到讨论利用jemalloc对内存占用的调试，能够清楚的 dump 出内存的使用情况，便尝试了下。

## 安装

``` bash
# 用于生成 pdf
yum -y install graphviz ghostscript

wget https://github.com/jemalloc/jemalloc/archive/5.1.0.tar.gz
tar zxvf 5.1.0.tar.gz
cd jemalloc-5.1.0/
./autogen.sh
./configure --prefix=/usr/local/jemalloc-5.1.0 --enable-prof
make -j
make install
```

## 程序退出时的用例和检查

``` bash
# run
MALLOC_CONF=prof_leak:true,lg_prof_sample:0,prof_final:true LD_PRELOAD=/usr/local/jemalloc-5.1.0/lib/libjemalloc.so.2  ./a.out

# 查看内存占用情况
/usr/local/jemalloc-5.1.0/bin/jeprof a.out jeprof.34447.0.f.heap
> top
```


## 长时间运行-测试用例

对于长时间运行的程序，例如服务端程序通常不能够退出，jemalloc提供每增长指定大小进行一次内存dump。

下面这个例子mock长时间运行的程序，分别测试顺序容器(vector)和关联容器(map)，string 和最基本的new，并且每100ms执行1000次，代表服务端的运行情况。

``` c++
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <chrono>
#include <thread>

int main() {

    std::vector<int> vec;
    std::map<int, int> mp;
    std::string s;
    for (;;) {
        for (int i = 0; i < 1000; ++i) {
            vec.push_back(i);
            mp[rand()] = i;
            s += "xxxx";
            new char[4];
        }
        std::this_thread::sleep_for(std::chrono::microseconds(100));
    }

    return 0;
}
```

编译运行:
``` bash
g++ test.cc -o a.out
```

将环境变量MALLOC_CONF设置为`prof:true,lg_prof_interval:26`使jemalloc开启prof并且每2^26字节(64M)大小进行一次dump，并且利用`LD_PRELOAD` 环境变量代替。

``` bash
export MALLOC_CONF="prof:true,lg_prof_interval:26"
LD_PRELOAD=/usr/local/jemalloc-5.1.0/lib/libjemalloc.so.2  ./a.out

[root@pwh c++]# ls -l -t
total 212
-rw-r--r-- 1 root root  5208 Dec 19 14:31 jeprof.17988.17.i17.heap
-rw-r--r-- 1 root root  5206 Dec 19 14:31 jeprof.17988.16.i16.heap
-rw-r--r-- 1 root root  5204 Dec 19 14:31 jeprof.17988.15.i15.heap
-rw-r--r-- 1 root root  5204 Dec 19 14:31 jeprof.17988.14.i14.heap
-rw-r--r-- 1 root root  5204 Dec 19 14:31 jeprof.17988.13.i13.heap
-rw-r--r-- 1 root root  5204 Dec 19 14:31 jeprof.17988.12.i12.heap
-rw-r--r-- 1 root root  5204 Dec 19 14:31 jeprof.17988.11.i11.heap
-rw-r--r-- 1 root root  5200 Dec 19 14:31 jeprof.17988.10.i10.heap
-rw-r--r-- 1 root root  5200 Dec 19 14:31 jeprof.17988.9.i9.heap
-rw-r--r-- 1 root root  5200 Dec 19 14:31 jeprof.17988.8.i8.heap
-rw-r--r-- 1 root root  5198 Dec 19 14:31 jeprof.17988.7.i7.heap
-rw-r--r-- 1 root root  5198 Dec 19 14:31 jeprof.17988.6.i6.heap
...
```

## 结果分析

由于是每隔一段内存大小进行的dump，每个文件都是内存的片段信息，利用`--base`指定从哪一份heap文件开始分析。

``` bash
$ /usr/local/jemalloc-5.1.0/bin/jeprof a.out --base=jeprof.17988.0.i0.heap  jeprof.17988.17.i17.heap
$ /usr/local/jemalloc-5.1.0/bin/jeprof a.out --base=jeprof.17988.0.i0.heap  jeprof.17988.17.i17.heap
Using local file a.out.
Argument "MSWin32" isn't numeric in numeric eq (==) at /usr/local/jemalloc-5.1.0/bin/jeprof line 5123.
Argument "linux" isn't numeric in numeric eq (==) at /usr/local/jemalloc-5.1.0/bin/jeprof line 5123.
Using local file jeprof.17988.17.i17.heap.
Welcome to jeprof!  For help, type 'help'.
(jeprof) top
Total: 1002.5 MB
   754.5  75.3%  75.3%    754.5  75.3% __gnu_cxx::new_allocator::allocate@4031fc
   124.0  12.4%  87.6%    124.0  12.4% __gnu_cxx::new_allocator::allocate@402fac
   124.0  12.4% 100.0%    124.0  12.4% std::__cxx11::basic_string::_M_mutate
     0.0   0.0% 100.0%   1002.5 100.0% __libc_start_main
     0.0   0.0% 100.0%   1002.5 100.0% _start
     0.0   0.0% 100.0%   1002.5 100.0% main
     0.0   0.0% 100.0%    754.5  75.3% std::_Rb_tree::_M_create_node
     0.0   0.0% 100.0%    754.5  75.3% std::_Rb_tree::_M_emplace_hint_unique
     0.0   0.0% 100.0%    754.5  75.3% std::_Rb_tree::_M_get_node
     0.0   0.0% 100.0%    124.0  12.4% std::_Vector_base::_M_allocate

# 导出为 pdf
/usr/local/jemalloc-5.1.0/bin/jeprof --pdf a.out  --base=jeprof.17988.0.i0.heap jeprof.17988.17.i17.heap   > a.pdf
```

## 统计内存使用情况

![jemalloc](/images/program/jemalloc.png)

取了新的一段内存区间将其导出为pdf后，总共分配使用718MB内存，其中在map的`[]`的操作符重载函数中占用了514.5MB，为string分配了60MB，为vector分配了60MB，而最基础的new char[4]的调用栈是停留在main()中，所以main()也占用了84MB，得到的数据和Total MB(718.5MB)吻合。

# ref

- https://www.yuanguohuo.com/2019/01/02/jemalloc-heap-profiling/
- http://jemalloc.net/
