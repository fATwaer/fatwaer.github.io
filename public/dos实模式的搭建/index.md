# DOS实模式的搭建


### 前言
王爽老师的《汇编语言》中练习习题8中，有要求在DOS实模式下操作汇编代码。
之前一直用的是windows 2003的CMD中自带的debug调试，所以趁这次机会，把DOS环境搭建一下。

### 安装
安装方法和普通ISO文件安装方法差不多，首先选择ISO文件、对应的操作系统，然后用vmware的默认硬件甚至一步一步确定就行。

![1.png]( /images/assembly/dos/1.png)

![2.png]( /images/assembly/dos/2.png)

接下来，启动虚拟机，会弹出一个选择页面，等待一段时间后会自动跳转到安装界面。

![3.png]( /images/assembly/dos/3.png)

![4.png]( /images/assembly/dos/4.png)

![5.png]( /images/assembly/dos/5.png)

![6.png]( /images/assembly/dos/6.png)

![7.png]( /images/assembly/dos/7.png)

然后会提示重新启动，跟着提示来，会提示一个错误：

![8.png]( /images/assembly/dos/8.png)


这应该是DOS支持的磁盘格式为FAT32，而现在的windows支持的硬盘格式是NTFS，两者格式不兼容导致的。
我们关闭虚拟机重新启动下，在下面这个界面按F2进入BIOS设置首先启动项：

![9.png]( /images/assembly/dos/9.png)

![10.png]( /images/assembly/dos/10.png)

### 修改启动项
跟着以下步骤操作： img [class names] 
**1. → 移动选项卡至 'boot'**
**2. ↓ 移动选项至 'CD-ROM Drive'**
**3. 按住 'shift' 和 '+' 将选中的CD-ROM Drive向上移动**
**4. 按F10保存退出**

![11.png]( /images/assembly/dos/11.png)

![12.png]( /images/assembly/dos/12.png)

![13.png]( /images/assembly/dos/13.png)

此时该虚拟机会重新启动，然后重新进入安装界面。
根据提示，一步一步按确定，基本都是肯定选项。
**[注意]直到提示关于 'Adds-On' 额外的软件安装，在这里我们选择 'Cancel' 取消，不进行额外的操作。**

![14.png]( /images/assembly/dos/14.png)

![15.png]( /images/assembly/dos/15.png)

![16.png]( /images/assembly/dos/16.png)

![17.png]( /images/assembly/dos/17.png)

如图可见，安装成功，重新启动。
重新启动后发现，还是进入的安装界面，这是因为之前在BIOS内设置过优先启动项的缘故。
和之前的操作一样，在vmware动画界面按F2进入BIOS，用**组合键 shift 和 -  将CD-ROM Drive**恢复到原来的位置(默认是第三个)。

![19.png]( /images/assembly/dos/19.png)

好了，到现在完成了DOS的安装了，但是还有个问题，就是VMware并没有给DOS提供vmtools，所以物理机和虚拟机之间传输文件并不方便。

### 文件传输
首先，我们先关闭DOS虚拟机，然后在**左侧硬件配置**处点击**硬盘**。

![20.png]( /images/assembly/dos/20.png)

![21.png]( /images/assembly/dos/21.png)

根据红色箭头提示，点击**映射**。

![22.png]( /images/assembly/dos/22.png)

然后把**"以只读文件模式打开文件"**前面的勾去掉，然后关闭警告，打开我的电脑，可以发现本地多出一个磁盘

![23.png]( /images/assembly/dos/3.png)

打开后可以看到DOS的实际文件，也就是说，我们可以直接对DOS的文件进行操作。
我们可以把自己的要编译的汇编代码放进去。**(图中"lab8.asm")**

![24.png]( /images/assembly/dos/24.png)

**再断开连接，否则DOS将无法启动。**
最后，我们再验证一下。

![25.png]( /images/assembly/dos/25.png)

![26.png]( /images/assembly/dos/26.png)

如图，纯DOS系统里已经有了自己放进去的文件。

> DOS 7.10.iso 云盘链接  : http://pan.baidu.com/s/1slPZQot 密码: x0ht
