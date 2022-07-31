---
title: "Shell Tools and Scripting"
date: 2020-02-13T20:55:13+08:00
draft: false
tags:
- shell
- globbing
categories:
  - language
---

## 前言

这篇笔记主要是说明一些bash scripts中要注意的问题，比如变量的赋值，函数，Shebang，特殊变量，通配符等；以及介绍一些提高在shell环境下提高工作效率的工具，例如查看使用方法的时候，可以快速翻阅 TLDR 获取命令的用法，而不用使用 man 手册慢慢地找相关的参数等。

### 基本变量

赋值变量通过 `foo=bar` 来完成，并且带空格的 `foo = bar` 不会成功，因为相当于直接连续调用 `foo` 、 `=` 、 `bar` 三个命令，另外双引号 `"` 会展开变量而单引号不会 `'` 。

``` bash
foo=bar
echo "$foo"
# prints bar
echo '$foo'
# prints $foo
```

### 函数

mcd.sh

``` bash
mcd () {
    mkdir -p "$1"
    cd "$1"
}
```
Here $1 is the first argument to the script/function

- `$0` - Name of the script
- `$1` to `$9` - Arguments to the script. `$1` is the first argument and so on.
- `$@` - All the arguments
- `$#` - Number of arguments
- `$?` - Return code of the previous command
- `$$` - Process Identification number for the current script
- `!!` - Entire last command, including arguments. A common pattern is to

更多参数相关

[Special Characters](https://www.tldp.org/LDP/abs/html/special-chars.html)

### 加载函数

    source mcd.sh
    mcd test

利用source读取函数后可以把.sh中的函数加载到shell环境中，于是可以直接使用函数名作为命令来执行，这里产生一个test文件并且进入到test目录中。

---

### 条件截断

类似于其他编程语言的函数截断，一般用于测试上一条命令的执行结果。

``` bash
false || echo "Oops, fail"
# Oops, fail

true || echo "Will not be printed"
#

true && echo "Things went well"
# Things went well

false && echo "Will not be printed"
#

false ; echo "This will always run"
# This will always run
```
---

### 命令替代

当在shell使用 $(CMD) 后，CMD命令将会被执行，并且会将这条命令的输出给替换掉。例如 `for file in $(ls)`先会调用ls，然后变量所有ls所输出的文件名。

另外一个很少被人知道的特性叫做 过程替代(**process substitution),** <( CMD ) 将会执行CMD指令，并且把输出放到一个临时文件内，然后把<()替换为这个临时文件的名字。例如 `diff <(ls foo) <(ls bar)` 将会显示 foo 和 bar 两个目录内的不同

``` bash
#!/bin/bash

echo "Starting program at $(date)" # Date will be substituted

echo "Running program $0 with $# arguments with pid $$"

for file in $@; do
    grep foobar $file > /dev/null 2> /dev/null
    # When pattern is not found, grep has exit status 1
    # We redirect STDOUT and STDERR to a null register since we do not care about them
    if [[ $? -ne 0 ]]; then
        echo "File $file does not have any foobar, adding one"
        echo "# foobar" >> "$file"
    fi
done
```

这个脚本所完成的事情是：在所有参数文件中，如果没有文件内没有grep到foobar这个字符串，那么就会输出 `File $file does not have any foobar, adding one` 输出到标准输出，然后追加 `# foobar" >> "$file` 到 $file 的结尾。

其中：

`$#` 代表该脚本执行使用的PID，

`$@`  所有参数，不包括$0。

`$?` 代表grep指令的运行结果，如果没有匹配到会输出不等于0的值。

`> /dev/null`  即 `1 > /dev/null`将标准输出指向null，

 `2 > /dev/null` 将标准错误输出指向null。

**if 判断**中的逻辑词和其他编程语言有些区别，具体可以看
    [http://man7.org/linux/man-pages/man1/test.1.html](http://man7.org/linux/man-pages/man1/test.1.html)

**`[]和[[]]` 的区别**:

[http://mywiki.wooledge.org/BashFAQ/031](http://mywiki.wooledge.org/BashFAQ/031)

> [ ("test" command) and [[ ("new test" command) are used to evaluate expressions. [[ works only in Bash, Zsh and the Korn shell, and is more powerful; [ and test are available in POSIX shells.

一般来说使用 `[[]]` 这种形式犯错的机会更少。

### shell globbing

一共分为两类：

- 通配符(Wildcards)： ? 和 *
    给定文件 foo, foo1, foo2, foo10, bar， `rm foo?` 会删除foo1和foo2， `rm foo*` 将会删除除了bar的所有文件。

- Curly braces `{}`

``` bash
convert image.{png,jpg}
# Will expand to
convert image.png image.jpg

cp /path/to/project/{foo,bar,baz}.sh /newpath
# Will expand to
cp /path/to/project/foo.sh /path/to/project/bar.sh /path/to/project/baz.sh /newpath

# Globbing techniques can also be combined
mv *{.py,.sh} folder
# Will move all *.py and *.sh files


mkdir foo bar
# This creates files foo/a, foo/b, ... foo/h, bar/a, bar/b, ... bar/h
touch {foo,bar}/{a..j}
touch foo/x bar/y
# Show differences between files in foo and bar
diff <(ls foo) <(ls bar)
# Outputs
# < x
# ---
# > y

```
---

### Shebang

``` python
#!/usr/local/bin/python
import sys
for arg in reversed(sys.argv[1:]):
    print(arg)
```

shell 知道使用python解释器而不是shell是因为写了一行叫做shebang的在脚本顶部。

但是由于不同机器的安装不一样，所以可以通过env来定位  `#!/usr/bin/env python`

---

### 函数与shell脚本的区别

1. 函数的语言需要和shell的语言相同，需要写shebang，所以前面mcd在不同的系统上不能使用，脚本倒是可以使用任意语言（废话
2. 函数会在定义式被读取的时候加载，脚本每次都会重新加载，函数比脚本稍微快点，但是每次修改都需要重新加载。
3. 函数是在shell环境下执行，能修改环境变量，而脚本在其进程中执行，所以执行脚本并不能改变文件路径，可以通过 `export` 来设置脚本的环境变量
4. modularity, code reuse and clarity of shell code，shell 脚本里也会有自己的函数

## 命令行工具

### shellcheck

- 安装
[koalaman/shellcheck](https://github.com/koalaman/shellcheck#installing)
    ``` bash
    yum -y install epel-release
    yum install ShellCheck
    ```



- 使用
    ``` bash
    iZbp1237a4x521y1gkpax4Z : /tmp/missing > shellcheck random.sh

    In random.sh line 3:
    n=$(( RANDOM % 100 ))
    ^-- SC2034: n appears unused. Verify it or export it.


    In random.sh line 5:
    if [[ n -eq 42 ]]; then
            ^-- SC2130: -eq is for integer comparisons. Use = instead.
            ^-- SC2050: This expression is constant. Did you forget the $ on a variable?d
    ```

    相当于shell脚本编译器，然后根据产生的错误到 [shellcheck wiki](https://github.com/koalaman/shellcheck/wiki/SC2003)找原因。

### TLDR

出去敲 `-help` 或者 `man cmd` 的方式查询使用，当仅仅只想知道某个命令怎么使用的时候，可以使用TLDR查询用法。


直接访问：[https://tldr.ostera.io/xargs](https://tldr.ostera.io/xargs)

或者去github下载相关客户端显示在命令行上：[https://tldr.sh/](https://tldr.sh/)

![tldr](/images/shell/tldr.png)

### 文件搜索: find使用

``` bash
# Find all directories named src
find . -name src -type d
# Find all python files that have a folder named test in their path
find . -path '**/test/**/*.py' -type f
# Find all files modified in the last day
find . -mtime -1
# Find all zip files with size in range 500k to 10M
find . -size +500k -size -10M -name '*.tar.gz'
```

### find后批量执行

``` bash
# Delete all files with .tmp extension
find . -name '*.tmp' -exec rm {} \;
# Find all PNG files and convert them to JPG
find . -name '*.png' -exec convert {} {.}.jpg \;
```

### 文件搜索: fd

fd 是 find 的简化版本，人性化许多。

- [How to install fd on CentOS](https://enting.org/how-to-install-fd-on-centos/)
- [sharkdp/fd](https://github.com/sharkdp/fd)
![fd](/images/shell/screencast.svg)

---

### 文件搜索: locate

locate也是一个用来找文件的命令，使用也比较简单。

``` bash
iZbp1237a4x521y1gkpax4Z : ~ > locate run.sh
/run.sh
/root/run.sh
/root/.vim/plugged/YouCompleteMe/third_party/requests_deps/urllib3/_travis/run.sh
/root/.vim/plugged/YouCompleteMe/third_party/ycmd/third_party/requests_deps/urllib3/_travis/run.sh
/root/mc/run.sh
/root/minecraft/run.sh
/root/openssl/openssl-OpenSSL_1_1_1-stable/demos/certs/ocsprun.sh
/root/ssr/shadowsocksr/logrun.sh
iZbp1237a4x521y1gkpax4Z : ~ >
```

但是locate有一些容易犯错的点，locate是通过unpdatedb来查询的，而updatedb通过crond进行更新，一般一天更新一次，所以有时候新下载下来的文件会出现找不到的情况，这时可以手动updatedb，即:

``` shell
$ updatedb
$ locate file
```

像我的centos上并没有自带locate，安装为：

``` shell
$ yum -y install mlocate
```

### 找代码: grep

常用的例子还是得看 TLDR：[https://tldr.ostera.io/grep](https://tldr.ostera.io/grep)，而自己最常用的还是 `grep -rn 'content' *` ， `-r` 用于递归， `-n` 用于打印行数。

![grep](/images/shell/grep.png)

另外还有ack, ag, rg等就不一一列举了。

- ack: [https://beyondgrep.com/](https://beyondgrep.com/)
- ag: [https://github.com/ggreer/the_silver_searcher](https://github.com/ggreer/the_silver_searcher)
- rg: [https://github.com/BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep)

### 找指令

这里倒是很简单，利用 `ctrl+r` 可以在历史里反向搜索，以及简单的利用管道进行grep： `history | grep cmd` 。另外 `fzf` 在这里推荐使用一下，在必要的时候可能比较有用。
fzf：[https://github.com/junegunn/fzf/wiki/Configuring-shell-key-bindings#ctrl-r](https://github.com/junegunn/fzf/wiki/Configuring-shell-key-bindings#ctrl-r)

一些其他的shell，和bash不同，提供了**基于历史的自动建议型shell**，像 `zsh` 和 `fish` 内都提供有。如果在命令中敲入了一些以明文显示的敏感性文字的话，可以在.bash_history或者.zhistory中删除。

Tips: 自己的机器可以使用一些便捷的的工具，但如果需要管理多台服务器甚至是集群，linux提供的最基础的find等命令还是记清楚的好。

### 目录导航

命令行下查看目录确实没有那么直观，可以利用 `ln -s` 创建一个软连接快速选择，当然也有一些命令行下的工具：

**Fasd ranks files and directories by frecency**

- fasd :[https://github.com/clvv/fasd](https://github.com/clvv/fasd)

**get an overview of a directory structure**:

- tree: [https://linux.die.net/man/1/tree](https://linux.die.net/man/1/tree)
- broot: [https://github.com/jarun/nnn](https://github.com/jarun/nnn)

**full fledged file managers**:

- nnn: [https://github.com/jarun/nnn](https://github.com/jarun/nnn)
- ranger: [https://github.com/ranger/ranger](https://github.com/ranger/ranger)

## 练习

1. Read `[man ls](http://man7.org/linux/man-pages/man1/ls.1.html)` and write an `ls` command that lists files in the following manner
    - Includes all files, including hidden files
    - Sizes are listed in human readable format (e.g. 454M instead of 454279954)
    - Files are ordered by recency
    - Output is colorized

    ``` bash
    ls -alth --color=auto
    ```


2. Write bash functions marco and polo that do the following. Whenever you execute marco the current working directory should be saved in some manner, then when you execute polo, no matter what directory you are in, polo should cd you back to the directory where you executed marco. For ease of debugging you can write the code in a file [marco.sh](http://marco.sh/) and (re)load the definitions to your shell by executing source [marco.sh](http://marco.sh/)

    ``` shell
    #!/bin/bash
    # marco.sh

    marco () {
        path=$(pwd)
        export MARCOPATH=$path
    }
    ```

    ``` shell
    #!/bin/bash
    # polo.sh

    polo () {
        cd "$MARCOPATH" && echo "cd error"
    }
    ```

    Marco Polo →（马可·波罗) :)

3. Say you have a command that fails rarely. In order to debug it you need to capture its output but it can be time consuming to get a failure run. Write a bash script that runs the following script until it fails and captures its standard output and error streams to files and prints everything at the end. Bonus points if you can also report how many runs it took for the script to fail.

    ``` shell
    #!/bin/bash

    echo "start capture the program failure log"

    cnt=0
    return_code=0
    while [[ $return_code -eq 0 ]]
    do
        output=$(sh "$1" 2>&1)
        return_code=$?
        cnt=$((cnt+1))
    done
    cnt=$((cnt-1))
    echo "failed after ${cnt}th."
    echo "output:"
    echo "$output"
    ```
    ![ex3](/images/shell/ex3.png)

4. As we covered in lecture `find`’s `-exec` can be very powerful for performing operations over the files we are searching for. However, what if we want to do something with **all** the files, like creating a zip file? As you have seen so far commands will take input from both arguments and STDIN. When piping commands, we are connecting STDOUT to STDIN, but some commands like `tar` take inputs from arguments. To bridge this disconnect there’s the `[xargs](http://man7.org/linux/man-pages/man1/xargs.1.html)` command which will execute a command using STDIN as arguments. For example `ls | xargs rm` will delete the files in the current directory.

    Your task is to write a command that recursively finds all HTML files in the folder and makes a zip with them. Note that your command should work even if the files have spaces (hint: check `-d` flag for `xargs`)

    ``` shell
    find . -name *.html -type f | xargs tar cf target.tar
    ```


