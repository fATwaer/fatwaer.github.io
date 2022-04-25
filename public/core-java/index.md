# Java 核心技术卷1 笔记


# 前言

最近想深入下数据库原理，在知乎和Google发现有几门开源的好课值得去学习。我选择的是6.830，首先是之前有刷过6.828，相对来说比较熟悉，不过实现是选择的是java，这也就是我为什么写博客的理由。另外也被人推荐的CMU15445,这门课程稍微浏览了下主页，是使用C++来实现的，并且课件PPT和视频都非常良心。


这是头一次认真接触JAVA，我使用的是《JAVA核心技术　卷１》,是一本相对来说比较方便C/C++程序员入坑的书，这篇博客也会根据这本书的目录作为大纲进行梳理。

# 基本结构

基本类型大多数语言其实差不了太多，不做太多废话，但是字符串的操作更加接近与python那一类的语言，自动拼接、垃圾回收之类的。
    
## 字符串

字符串判断为空：

    if (str.length() == 0)
    or 
    if (str.equals(""))    

虽然可以进行字符串拼接，但是效率比较低，可以使用`StringBuilder`类:

    StringBuilder builder = new StringBuilder();
    builder.append(ch);
    builder.append(str);
    builder.toString();

## 作用域

JAVA的作用域和C/C++不同，内部块中的同名变量名不会覆盖外部块的变量名，甚至无法通过编译。所以在内部块中需要取不同的变量名，但在class中，可以使用`this`指针来指定变量。

## 数组

JAVA的数组都是分配在堆上，这又是和C/C++不同的一点：

JAVA中的:

    int[] a = new int[100];

等同于C/C++中的: 

    int* a = new int[100];

不同于:

    int a[100];

并且数组的完整拷贝通过方法`Arrays.copyOf()`:

    newArr = Arrays.copyOf(oldArr, oldArr.lenght());

也可以通过这个方法来扩展数组：

    Arr = Arrays.copyOf(Arr, 2 * Arr.lenght());


# 对象与类

OO应该是JAVA的重点，OOP三个特性：
- 封装：用一个类将实现和使用分开，只保留接口与外部进行联系。
- 继承：子类自动继承其父类的属性和方法，并且可以添加新的方法和属性。
- 多态：虽然多个子类都有同一个方法，但是子类的子类实例化之后都可以获得完全不同的结果。

通过下面的方法实例化一个类：

    new Date();

如果想使用类中的一个方法：

    System.out.println(new Date().toString());

## final 关键字

`const`关键字相当于`const`关键字即不可变的意思，并且在构造一个类的时候必须要被初始化。

## static 关键字

`static`关键字其实也很类似，将`static`理解为类的方法和域即可而不是对象的方法和域。
例如:
    
``` java
class Employee {
    ...
    public static currentId;
    
    public static int getId() {
        return currentId;
    }
    ...
}
```
调用使用

``` java
    int id = Employee.curremtID;
    int id = Employee.getId();
```

## main方法

有意思的是java的每一个类里面都可以有main函数，这方便了java为每一个类做单元测试，自己在coding的时候也确实经常用到类的main函数进行测试。

## 初始化块

初始化块也非常有意思，直接在类域里面输入大括号就能在调用构造器的时候执行。例如：

``` java
class Employee {
    private int id;

    // initializeation block
    {
        id = 1;
    }
}
```

# 类继承

java中继承的关键字是`extends`,并且注意子类中的方法不能直接访问超类中的`private`域，所以需要通过在超类中准备`访问器`，利用`super`关键字来获取`private`域，构造函数也是如此。

``` java
class Manager extends Employee{
    public Manager(String name) {
        super(name);
        ... // other initialization
    }
}
```

## 强制转化

`强制转化`可以发生在类的子类和超类转化中，进行类型转化的唯一原因是：__在暂时忽视对象的实际类型后，使用对象的全部功能__。并且，将一个子类的引用赋值给超类的时候，编译器是允许的，但是将一个超类赋值给一个子类变量，必须进行类型转化。

对于测试强制类型转化，可以使用下面的tricks:
``` java
if (staff instanceof Manager)
{
    boss = (Manager) staff;
    ...
}
```
意思是，如果staff是`Manager`的一个实例，那么可以发生强制转化，当然必须是一个继承链才能成立。

## 抽象类

抽象类的意义是提供一个较高层次的抽象，作为基类的存在，关键词是`abstract`。抽象类中的方法只是充当占位的角色，真正对方法的实现发生在子类中，并且抽象类不能被实例化。

如果子类实现了全部的抽象方法，那么子类就不是抽象的。但若子类只定义了部分抽象类或不定义抽象类的方法，子类也必须标记为抽象类。

## 受保护访问

`protected`关键词可以使得子类能够访问该域，但是外部代码不行，不过通常都是谨慎使用protected类，因为违背了OOP提倡的数据封装原则。

## 继承的设计技巧

1. 将公共操作和域放在超类中
2. 不使用`protected`
3. 使用继承实现"is-a"关系
4. 除非所有的继承方法都有意义，否则不使用继承
5. 覆盖方法时，不要改变预期行为
6. 使用多态，而非类型信息


# 接口、lambda、内部类

java提供的这三种机制是用来弥补类和类继承一些地方的不灵活性而创立的高级技术。


## 接口

书上给了一个很好的理解接口的解释：”如果类遵从某个特定的接口，那么就履行这项服务“。即如果要调用数组的排序服务，那么这个数组中的类需要提供一个不同对象之间进行比较的接口。

比如，用`Employee`类提供接口,关键词是`implements`，之后跟随的是要提供的接口:

``` java
class Employee implements Compareble<Employee> {
    public int compareTo(Employee other) {
        ... // implements
    }
    ...
}
```

当然，在某一处提供了接口的代码，类似于声明的作用：

``` java
public interface Comparable {
    int compareTo<Object other>
}
```

其中`Object`类是所有类的超类。

接口不是类，所以不能被实例化，但是可以声明接口的变量：

    Comparable x;

然后引用实现了接口的类对象：

    x = new Employee(...);

接口不能包含实例域和静态方法，但是可以包含常量。

接口概念对于抽象类来说是不同的，抽象类只能用在继承链之中，每个子类只能继承一个超类，但是接口可以实现多个，提高了代码复用。

### 深拷贝和浅拷贝

java每个变量其实可以理解为一个指针或者引用，它们引用一个内存空间作为对象实例的存储位置，但是对象实例中也可能引用了其他的对象。

浅拷贝就是单单拷贝该变量引用的内存部分，但是深拷贝会将该对象内部所引用的对象也拷一份。

比如：

``` java 
class Employee implements Cloneable {
    ...
    public Employee clone() {
        Employee cloned = (Employee) super.clone();
        cloned.hireDay = (Date) hireDay.clone();
    }
}
```
这样就是深拷贝，在拷贝完本身的内容后还会递归拷贝所引用对象的内存。


## lambda表达式

lambda就是一个代码块，表达形式为 (参数) -> 表达式。
例如:

``` java
Comparator<String> comp = (first, second)
        -> first.length() - second.length();
```

---

如果出现如下类似的lambda表达式:

``` java
x->System.out.println(x)
```
那么可以简写为:

``` java
System.out::println
```

lambda表达式中的一些限制：

1. 只能引用不会改变的变量
2. 表达式捕获的变量必须是实际上的最终变量
3. lambda中的局部变量不能与外部变量重名

可以使用`Runable`来保存一个lambda,类似于回调：

``` java
Runable an = (int a, int b)->System.out.println(a+b);
...
...
an.run();
```


## 内部类

顾名思义，内部类就是定义在一个class内部的类，使用原因：
- 内部类方法可以访问该类定义所在作用域中的数据，包括私有数据
- 内部类可以对同一类中的其他类隐藏起来
- 若想定义一个回调函数，使用匿名内部类会比较便捷

内部类其实是相对于所在类的一个独立的类，当`new`操作符新建一个实体的时候，并不会实体化内部类，内部类需要独立进行实例化。不过，内部类和所在类建立了一定的联系使得内部类可以访问外围类的数据。

内部类的初始化语法稍微有点复杂：

    outerObject.new InnerClass(construction parmeter)

例如：

``` java
TalkingClock jabberer = new TalkingClock(1000, true);
TalkingClock.TimePrinter listener = jabberer.new TimerPrinter();
```

内部类的一些限制：
- 内部类声明所有的静态域必须要`final`，对于每一个外围类只需要有一个静态域的实例，若不是`final`，则分别会有单独的内部类实例。
- 类似于lambda，访问外围局部变量也需要保证被引用的局部变量是事实上的`final`,内部类引用的时候，实际上创建了一份备份，防止外围类被垃圾回收的时候，引用出错，并且声明为`final`使得内部类和外围类引用的同一个实体。

有一种方法来绕过这个限制，使用长度为1的数组：

``` java
int[] conuter new int[1];
for (int i = 0; i < dates.length; i++)
    dates[i] = new Date()
        {
            public int compareTo(Date other);
            return super.compareTo(other);
        };
```

## 匿名内部类

匿名内部类是一种很方便的工具来扩充某个接口，它的语法如下：

``` java
new SuperType(construction parameters)
    {
        inner class methods and data
    }
```

常用的使用方式为

``` java
Person queen = new Person("Mary");
    // normal object
Person count = new Person("Dracula") 
    {
        ...
    };
    // a object extending Person
```


