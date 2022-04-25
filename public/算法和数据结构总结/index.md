# 算法与数据结构总结


CLRS快撸完一半了，所以趁开学前做下小总结，CLRS研究问题的方式和平时的感觉有那么些不太一样，但是接触久了就会慢慢习惯，主要注重算法的运行时间和算法可行性。初阶学习目标是掌握几种重要的排序算法和课堂中没有学到的数据结构。

首先还要推荐一下usfca的这个算法可视化的网站：https://www.cs.usfca.edu/~galles/visualization/RedBlack.html

# 排序算法
排序算法在系统学习之前，只会冒泡排序，非常简单但是时间复杂度为O(n^2)的算法，是一种没有怎么优化过的想法。


## 插入排序
插入排序(insert sort)是学习CLRS最先接触的算法，可以理解为将序列中的元素插入到一个已经排序好的队列中去。提供一个序列的起始位置(be)和长度(len)，循环从起始位置的下一个元素开始迭代，作为需要插入的数值(key)，将所有大于关键字元素后移一位，最后在放入对应的位置。期望运行时间(n^2)。
```　C++
    for (int i = be + 1; i < len; i++) {
        int key = a[i];
        int j = i - 1;
        while (j >= 0 && a[j] > key) {
            a[j+1] = a[j];
            j--;
        }
        a[j+1] = key;
    }
```

## 归并排序
归并排序(merge sort)是接触分治法接触到的算法，这种方法是将需要解决的问题细分为细小的问题，然后递归求解这些子问题，直接求解，最后将这些子问题的解合并成原问题的解。应用到排序算法中的话就是将待排序的元素分成n/2两个子序列，然后递归解决子序列的顺序问题，最后合并两个已排序的子序列，形成排序好的队列。期望运行时间(nlgn)。

首先是归并过程的辅助函数:

``` C++
void
SortAlgorithm::mergeArray(int p, int q, int r)
{
    int n1 = q - p + 1;
    int n2 = r - q;
    int L[n1], R[n2];
    int i1, i2;

    for (int i = 0; i < n1; i++)
        L[i] = a[p+i];
    for (int i = 0; i < n2; i++)
        R[i] = a[q+i+1];

    i1 = 0;
    i2 = 0;
    for (int k = p; k <= r; k++) {
        if ((L[i1] <= R[i2] && i1 < n1 )|| i2 == n2) {
            a[k] = L[i1];
            i1++;
        } else {
            a[k] = R[i2];
            i2++;
        }
    }
}
```
前面两个for循环是赋值递归过程已经排好的两个子数组left和right，然后根据i1和i2所指向的数组元素大小放入到原来的数组中去，完成两个子数组的归并。

然后是一个将问题分解的递归过程:
``` C++
void
SortAlgorithm::mergeSort(int p, int r)
{
    int q;

    if (p < r) {
        q = (r + p) / 2;

        mergeSort(p, q);
        mergeSort(q+1, r);

        mergeArray(p, q, r);
    }
}
```

## 主定理
//todo

## 堆排序
堆的性质比较简单，以最大堆为例，父节点必须大于等于子节点的值。另外还有个重要的推论：叶子节点的下标分别是n/2+1，　n/2+2, ｎ/2+3, ..., n。其中，堆排序的最坏运行时间期望是(nlgn)。

实现堆的过程首先是:

1. 位置关系和辅助函数

``` C++
inline int
PARENT(int i)
{
    return i / 2;
}

inline int
LEFT(int i)
{
    return i * 2;
}

inline int
RIGHT(int i)
{
    return i * 2 + 1;
}

inline void
pSwap(int &x, int &y)
{
    int temp = x;
    x = y;
    y = temp;
}
```
2. 堆的维护过程

将指定节点与左右节点相互比较，让三个节点中最大的节点成为父节点。
``` C++
void
SortAlgorithm::maxHeapify(int i)
{
    int l = LEFT(i);
    int r = RIGHT(i);
    int lagest;

    if (l < arrayLength() && a[i-1] < a[l-1])
        lagest = l;
    else
        lagest = i;
    if (r < arrayLength() && a[lagest-1] < a[r-1])
        lagest = r;

    if (lagest != i) {
        pSwap(a[i-1], a[lagest -1]);
        maxHeapify(lagest);
    }
}
```

3. 建立堆

将一个已有的序列形成堆，利用由下往上的方法建立。
``` C++
void
SortAlgorithm::bulidMaxHeap()
{
    for (int i = arrayLength()/2; i >= 1; i--)
        maxHeapify(i);
}

```

4. 堆排序

建成好的堆的根节点是这个序列的最大值，所以，将这个节点先排除出来，然后再进行堆化，可以找出次最大值，依次类推得到一个排好序的队列。
``` C++
void
SortAlgorithm::heapSort()
{
    for (int i = arrayLength(); i >= 2; i--) {
        pSwap(a[0], a[i-1]);
        maxHeapify(1);
        len--;
    }
}
```
先将最大值根节点与数组的端节点交换，然后将长度减少1，对根节点堆化，重新形成最大堆。




## 快速排序
快排是一种使用广泛的排序，虽然最坏运行情况是时间复杂度是(n^2)，但是在元素不用的情况下，期望时间复杂度是(nlgn)，并且，快速排序的过程中不用不会用到临时数组作为存储，也就是说，快速排序是原址排序的。快排的思想和归并一样，先将问题进行分解再归并。

快排的代码不长，代码比想象中要神奇。

首先是原址重排：
``` C++
int
SortAlgorithm::partitionArray(int p, int r)
{
    int key = a[r-1];
    int i = p - 1;

    for (int k = p; k <= r; k++) {
        if (a[k-1] < key) {
            i++;
            pSwap(a[i-1], a[k-1]);
        }
    }
    pSwap(a[i+1-1], a[r-1]);
    return i+1;
}
```
这个函数的作用就是将(p->r)的数组进行划分，把数组端点的值作为划分界限，也叫主元。然后递归下去，将每一个小区域进行排序，完成排序。

然后是分治的过程：
``` C++
void
SortAlgorithm::quickSort(int p, int r)
{
    if (p < r) {
        int q = partitionArray(p, r);
        quickSort(p, q-1);
        quickSort(q+1, r);
    }
}
```
ps:是先进行分治然后再细分的。

## 计数排序

基数排序(count sort)也是一种比较神奇的算法，要用到三个数组。时间复杂度为(k+n)。

``` C++
void
SortAlgorithm::countSort()
{
    // the size fo array c must
    // bigger than the maximum number
    // in the array a.
    int length = arrayLength();
    int b[length], c[length];

    for (int i = 0; i < length; i++) {
        c[i] = 0;
        b[i] = 0;
    }


    for (int i = 1; i <= length; i++)
        c[a[i-1]]++;

    for (int i = 1; i < length; i++)
        c[i] = c[i-1] + c[i];

    for (int i = length; i >= 1; i--) {
        b[c[a[i-1]]-1] = a[i-1];
        c[a[i-1]]--;

    }


    for (int i = 0; i < length; i++)
        a[i] = b[i];

}
```

计数排序的主要用第2，3，4个循环进行排序，其中a[i]对应着序列的值，C[i]对应在数组B中最后填充的位置。每当填充一个，C[i]就会进行减1操作，实际上就是对应在数组B中的位置往前面移动一位。


## 基数排序

基数排序(radix)在针对数值不大的情况是一种很好的排序算法，其中会用到一种稳定的排序算法作为子算法排序，虽然用到了其他的算法，但是更加重要的其想法。针对数值的相应位进行比较排序。

用到了三个辅助函数:

``` C++
int
getBase(int n)
{
    int d = 0;
    while (n/10 != 0)
        n /= 10, d++;
    return d;
}

int
power(int base,int p)
{
    if (p == 0)
        return 1;
    if (p == 1)
        return base;

    int result = power(10, p/2);

    if (p % 2 == 1)
        return base * result * result;
    else
        return result * result;
}

int
getNumber(int n, int d)
{
    if (d == 0)
        return n % 10;
    return (n % power(10, d+1)) / power(10, d);
}
```
getBase()获得元素的基数,

power获取以base为底,p为幂值的数值,

getNumber()获取对应位数的值。

然后进行对应数位的排序移位:

``` C++
void
SortAlgorithm::radixSort()
{
    int maxBase = 0;
    int d;
    int b[arrayLength()];

    for (int i = 0; i < arrayLength(); i++) {
        d = getBase(radixArr[i]);
        maxBase = maxBase > d ? maxBase : d;
    }

    for (int i = 0; i < maxBase+1; i++) {
        for (int j = 0; j < arrayLength(); j++)
            b[j] = getNumber(radixArr[j], i);

        dependInsertSort(b, 0, arrayLength());
    }
}
```

# 数据结构


## 散列表

## 二叉搜索树


二叉搜索树建立好后就已经是一个排序好的序列了，只要执行中序遍历，就是顺序序列。首先声明这样一个结构体来代表叶节点。


``` C
typedef struct treenode {
    treenode(int value);
    int key;
    struct treenode *left;
    struct treenode *right;
    struct treenode *p; //parent
}node;
```
以及用来整合二叉树操作的类，其中包含一个数据来存放树的根节点。
``` C++
class BinarySearchTree
{
    public:
        BinarySearchTree();
        void treeInsert(node *z);
        void inorderTreeWalk(node *x);
        node* getRoot();
        node* searchNode(int value);
        node* treeMin(node *x);
        node* treeMAX(node *x);
        node* successor(node *x);
        void treeDelete(node *z);
        void transplant(node* u, node* v);

    private:
        node *root;
};
```
二叉搜索树中的删除操作要分情况讨论:

1. 如果节点没有孩子节点，那么直接替换该节点为`null`即可。
2. 如果只有一个孩子，那么用孩子节点进行替换。
3. 如果有两个孩子，那么寻找该节点的后继（顺序序列的下一个值）来代替该节点，并且后继节点一定在该节点的右子树中。

首先是要一个辅助过程tansplant来帮助删除，即用`u`的双亲来代替`v`的双亲。
``` C++
void
BinarySearchTree::transplant(node *u, node *v)
{
    // v -> u
    if (u->p == NULL)
        root = v;
    else if (u == u->p->left)
        u->p->left = v;
    else
        u->p->right = v;

    if (v != NULL)
        v->p = u->p;
}
```
然后就是根据三种情况来删除节点:

``` C++
void
BinarySearchTree::treeDelete(node *z)
{
    if (z->left == NULL)
        transplant(z, z->right);

    else if (z->right == NULL)
        transplant(z, z->left);

    else {
        node *y = treeMin(z->right);
        if (y->p != z) {
            transplant(y, y->right);
            y->right = z->right;
            y->right->p = y;
        }

        transplant(z, y);
        y->left = z->left;
        y->left->p = y;
    }
}
```


## 红黑树
红黑树是一种平衡树，大致意思就是树的节点会分散得比较平均。相比二叉搜索树来说，执行一些动态集合操作比如插入删除，搜索的时候执行会比较快，可以保证最差情况下，动态集合操作的时间复杂度为nlgn。

红黑树的性质：
1. 每个节点都是红色或者黑色的。
2. 根节点是黑色的。
3. 每个叶节点都是黑色的(nil)。
4. 如果一个节点是红色的，那么两个子节点都是黑色的。
5. 从某个节点出发，到其叶子节点的简单路径上，所包含的黑色节点相同。

所以引申出一颗有n个及诶单的红黑树的高度最高为2lg(n+1)。

实现红黑树的插入操作之前，需要用到一个旋转操作来保持二叉搜索树性质:
![11]()
左旋操作：
``` C++
void
rbtree::LeftRotate(rbnode *x)
{
    rbnode *y = x->right;
    x->right = y->left;

    if (y->left != NULL)
        y->left->p = x;
    y->p = x->p;

    if (x->p == NULL)
        root = y;

    else if (x == x->p->left)
        x->p->left = y;

    else
        x->p->right = x;

    y->left = x;
    x->p = y;
}
```
右旋操作：
``` C++
void
rbtree::RightRotate(rbnode *y)
{
    rbnode *x = y->left;
    y->left = x->right;

    if (x->right != NULL)
        x->right->p = y;
    x->p = y->p;

    if (y->p == NULL)
        root = x;

    else if (y == y->p->left)
        x = y->p->left;

    else
        x = y->p->right;

    x->right = y;
    y->p = x;

}
```
然后是插入操作，和二叉搜索树一样，通过和节点比对大小确定插入的位置，但是多出一个把新的节点涂色的过程，新的节点会被涂成红色，方便进行平衡二叉树，插入操作完成后，要对红黑树的性质进行检查，并且修复RBT。

插入操作实现：
``` C++
void
rbtree::RBInsert(rbnode* z)
{
    rbnode *x, *y;
    y = NULL;
    x = root;
    while (x != NULL) {
        y = x;
        if (z->key < x->key)
            x = x->left;
        else x = x->right;
    }
    z->p = y;

    if (y == NULL)
        root = z;
    else if (z->key < y->key)
        y->left = z;
    else
        y->right = z;

    z->c = RED;
    z->left = NULL;
    z->right = NULL;
    RBinsertFixup(z);

}
```

新插入的节点是红色，如果此时其父节点也是红色，那么就违反了性质4，因此要进行红黑树的修复操作，红黑树的插入修复有三种情况：
（假定新插入的节点为`z`，父节点为`z.p`,叔节点为`y`）
- __a.__ z节点的叔节点y是红色的，那么将z.p和y都着为黑色，z.p.p着为红色，并且将z指向z.p.p

![case1]()
- __b.__ z的叔节点y是黑色，并且z是一个右孩子，那么对z的父节点z.p进行左旋操作。

![case2]()
- __c.__ z的叔节点y是黑色，并且z是一个左孩子，那么就将z.p着为黑色，z.p.p着为红色，对z.p执行右旋操作。

---

以上只是针对一边的情况，另外一侧镜像对称操作，下面是修复操作的实现：
``` C++
void
rbtree::RBinsertFixup(rbnode* z)
{
    rbnode *y;

    printf("node : %d %s\n", z->key, z->c ? "RED":"BLACK");
    while (z->p != NULL && z->p->p != NULL && z->p->c == RED) {
        if (z->p == z->p->p->left) {
            y = z->p->p->right;
            /*case 1*/
            if (y != NULL && y->c == RED) { //uncle node is red
                z->p->c = BLACK;
                y->c = BLACK;
                z->p->p->c = RED;
                z = z->p->p;
            } else  {
                if (z == z->p->right) {
                    /*case 2*/
                    z = z->p;
                    LeftRotate(z);
                }
                /*case 3*/
                z->p->c = BLACK;
                z->p->p->c =RED;
                RightRotate(z->p->p);
            }

        }else {
            y = z->p->p->left;
            if (y != NULL && y->c == RED) {
                z->p->c = BLACK;
                y->c = BLACK;
                z->p->p->c = RED;
                z = z->p->p;
            } else {
                if (z == z->p->left) {
                    z = z->p;
                    RightRotate(z);
                }
                z->p->c = BLACK;
                z->p->p->c = RED;
                LeftRotate(z->p->p);

            }
        }
    }
    root->c = BLACK;
}
```
实现删除操作之前，要准备两个辅助函数，一个用来更换父节点，一个用来寻找节点的后继。

首先是transplant将u的父节点的子节点更换为v的操作：
``` C++
void
rbtree::rbTransplant(rbnode *u, rbnode *v)
{
    if (u->p == NULL)
        root = v;
    else if (u == u->p->left)
        u->p->left = v;
    else
        u->p->right = v;
    if (v != NULL)
        v->p = u->p;
}
```
寻找某个节点后继即寻找左孩子的右子树：
``` C++
rbnode *
rbtree::minimum(rbnode *x)
{
    while (x->left != NULL)
        x = x->left;
    return x;
}
```
删除操作也和二叉搜索树想类似，如果只有一个节点就简单删除；否则，寻找后继节点来替代被删除的节点，但是红黑树需要对颜色进行跟踪，如果被替换的节点y原来是黑色，那么就引起了黑高变化，因此会进行红黑树修复操作。
``` C++
void
rbtree::rbDelete(rbnode *z)
{
    rbnode *x, *y = z;
    color origin = y->c;
    if (z->left == NULL) {
        x = z->right;
        rbTransplant(z, z->right);
    } else if (z->right == NULL) {
        x = z->left;
        rbTransplant(z, z->left);
    } else {
        y = minimum(z->right);
        origin = y->c;
        x = y->right;
        if (y->p == z) {
            if (x != NULL)
                x->p = y;
        }
        else {
            rbTransplant(y, y->right);
            y->right = z->right;
            y->right->p = y;
        }
        rbTransplant(z, y);
        y->left = z->left;
        if (y->left != NULL)
            y->left->p = y;
        y->c = z->c;
        free(z);
    }
   if (origin == BLACK)
        rbDeleteFixup(x);
}
```
删除修复工作有些复杂，这里没有理解为什么这么做，先记下来：
1. x的兄弟节点w是红色，那么改变w和x.p的颜色，然后对x.p做一次左旋。
![]()
2. x的兄弟节点w是黑色，且w的两个子节点都是黑色，那么将w着为黑色并且将x指向x.p。
3. x的兄弟节点w是黑色，且w的左孩子是红色的，w的右孩子是黑色的，那么交换w和w.left的颜色，并且对w执行右旋。
4. x的兄弟节点w是黑色，且w的右孩子是红色的，那么将w的颜色着为x.p的颜色，w.right和x.p都着为黑色，并且对x.p执行左旋。

同样的，以上情况只针对左子树，右子树的处理镜像对称。

删除操作的实现：
``` C++
void
rbtree::rbDeleteFixup(rbnode *x)
{
    rbnode *w;

    while (x != root && x->c == BLACK) {
        if (x == x->p->left) {
            w = x->p->right;
            if (w->c == RED) { //case 1
                w->c = BLACK;
                x->p->c = RED;
                LeftRotate(x->p);
                w = x->p->right;
            }
            if (w->left->c == BLACK && w->right->c == RED) { // case 2
                w->c = RED;
                x = x->p;
            } else {
                if (w->right->c == BLACK) { // case 3
                    w->left->c = BLACK;
                    w->c = RED;
                    RightRotate(w);
                    w = x->p->right;
                }
                // case 4
                w->c = x->p->c;
                x->p->c = BLACK;
                w->right->c = BLACK;
                LeftRotate(x->p);
                x = root;
            }
        } else {
            w = x->p->left;
            if (w->c == RED) {
                w->c = BLACK;
                x->p->c = RED;
                RightRotate(x->p);
                w = x->p->left;
            }
            if (w->left->c == RED && w->right->c == BLACK) {
                w->c = RED;
                x = x->p;
            } else {
                if (w->left->c == BLACK) {
                    w->right->c = BLACK;
                    w->c = RED;
                    LeftRotate(w);
                    w = x->p->left;
                }
                w->c = x->p->c;
                x->p->c = BLACK;
                w->left->c = BLACK;
                RightRotate(x->p);
                x = root;
            }
        }
    }

    x->c = BLACK;
}
```

# 扩展数据结构

## 区间树

## 动态统计树


# 动态规划

## 最长公共子序列问题
这个问题为了求出两个字符序列xy中最长的公共子序列(LCS)，用i和j分别代表xy的长度，解决这个问题的方法是分别从字符序列的一段开始比较，分成两种情况：
1. 如果x[i] == y[j]，那么说明这个字符是公共字符，属于LCS。那么，接下来只要将这个字符加入到LCS中，并且将序列xy的长度进行减１，继续求出剩下序列的LCS。
2. 如果x[i] != y[j]，那么说明x[i-1]和y[j] 或者 x[i]和y[j-1]存在LCS。

这样可以得到递归式：

- 当x[i] == y[j]时，C[i][j] = C[i-1][j-1]+1
- 当x[i] != y[j]时，C[i][j] = max{C[i-1][j], C[i][j-1]}

首先定义了一个方向的枚举类型：
``` C++
enum direction {
    LEFT = 0,
    UP,
    UpperLeft
};
```

LCS问题用递归的方法更加容易理解和操作：
```　C++
int
DynamicProgramming::LCSlengthRecursive(int i, int j)
{

    if (i == 0 || j == 0)
        return 0;

    if (strA[i-1] == strB[j-1])
        c[j][i] = LCSlengthRecursive(i-1, j-1) + 1;
    else {
        int x, y;
        x = LCSlengthRecursive(i-1, j);
        y = LCSlengthRecursive(i, j-1);
        c[j][i] = x > y ? x : y;
    }

    return c[j][i];

}
```
然后发现决策树里多次重复出现求同样的子问题的情况，那么可以去掉这些重复的操作，进行一下优化。
``` C++
int
DynamicProgramming::LCSlengthRecursive(int i, int j)
{

    if (c[j][i] == 0){
        if (i == 0 || j == 0)
            return 0;

        if (strA[i-1] == strB[j-1])
            c[j][i] = LCSlengthRecursive(i-1, j-1) + 1;
        else {
            int x, y;
            x = LCSlengthRecursive(i-1, j);
            y = LCSlengthRecursive(i, j-1);
            c[j][i] = x > y ? x : y;
        }
    }

    return c[j][i];

}
```
但是迭代的速度更快：
``` C++
void
DynamicProgramming::LCSlengthIterate()
{
    int i = 0, j = 0;

    for (i = 1; i < m; i++)
        c[0][i] = 0;
    for (i = 0; i < n; i++)
        c[i][0] = 0;

    /*CASE DILIVER*/
    for (i = 1; i < n; i++)
        for (j = 1; j < m; j++)
            if (strA[j-1] == strB[i-1]) {
                c[i][j] = c[i-1][j-1] + 1;
                b[i][j] = UpperLeft;
            } else if (c[i][j-1] >= c[i-1][j]) {
                c[i][j] = c[i][j-1];
                b[i][j] = LEFT;
            } else {
                c[i][j] = c[i-1][j];
                b[i][j] = UP;
            }
    }

    PrintLCS(b, c, m, n);
}
```
这个函数后半部分是做LCS各种情况的派发的，两层for循环，内层代表这个表格的x轴，外层代表表格的y轴，将i和j所指的元素进行比较，如果相同根据第一种情况从子问题中获取最优解，也就是长度分别为`i-1`和长度为`j-1`的子序列获取LCS，并且由于ij所指定位置相等，该位置进行自增。数组C用来记录LCS的长度，数组B用来LCS的路径。

在准备输出LCS的时候，想起来要传递两个二维数组，才能递归输出，然后踩到了一个关于[二维数组与二级指针转换问题](about:blank)的坑，一种更好的解决办法是把这一部分准备二维数组的操作放入到构造函数内去，并且在析构函数中释放掉：
``` C++
/*constructor*/
DynamicProgramming::DynamicProgramming(string s1, string s2)
: strA(s1), strB(s2), lcs("") , m(strA.length()+1), n(strB.length()+1)
{
        c = (int **) malloc (sizeof(int *[m]) * n);

        *b = (direction *)malloc(sizeof(direction) * m * n);
        *c = (int *)malloc(sizeof(int) * m * n);

        for (int y = 1; y < n; y++ ) {
            b[y] = b[y-1] + m;
            c[y] = c[y-1] + m;
        }
}

/*destructor*/
DynamicProgramming::~DynamicProgramming()
{
    //dtor
    free(*c);
    free(*b);
    free(c);
    free(b);
}
```
。输出递归函数根据数组B所记录的方向进行输出，得到LCS：
``` C++
void
DynamicProgramming::PrintLCS(direction **b, int **c, int x, int y)
{

    if (x == 0 || y == 0)
        return ;

    if (b[y-1][x-1] == UpperLeft) {
        PrintLCS(b, c, x-1, y-1);
        cout << strB[y-2] <<endl;

    } else if (b[y-1][x-1] == LEFT)
        PrintLCS(b, c, x-1, y);

    else
        PrintLCS(b, c, x, y-1);
}
```
# 贪心算法
贪心问题是每一步都选择最优解,从而达到最有解的情况，相比于动态规划，其编程复杂性比较低。
## 活动选择问题
该问题是从起始时间和结束时间不同的多个活动中，选取尽量多的活动，那么贪心的运用就是，先将该活动序列以结束时间进行排序，然后依次选择合适的结束时间早的活动，得到最优解。

递归实现：
``` C++
void
ActivitySelect::recursive_selector(int k, int n)
{
int m = k + 1;

while (m < n && f[k] > s[m])
    m++;
if (m <= n) {
    greedy_sequence.push_back(m);
    recursive_selector(m, n);
}
}
```
迭代版本：
``` C++
void
ActivitySelect::iterative_selector(int n)
{
int k = 1;
greedy_sequence.push_back(k);
for (int m = 2; m <= n; m++)
    if (s[m] >= f[k]) {
        greedy_sequence.push_back(m);
        k = m;
    }
}
```
为了方便实现并集操作，这里选择将结果的集合用vector来处理。


## 霍夫曼编码
霍夫曼编码常用于压缩数据，是在给定字符频率的情况下，获取最优的压缩率，霍夫曼树向左下降就是编码添加0，向右即为1，为了取得较好的压缩率，所以，频率高的关键字应该在接近树根的位置，相应地，频率低的节点应该在叶子节点附近。

其结构体定义也比较简单，二叉树节点中加入键值和频率即可：
``` C++
typedef struct huffmantree{
    huffmantree() = default;
    huffmantree(char c, int f) : freq(f), character(c){}
    int freq;
    char character;
    struct huffmantree *left;
    struct huffmantree *right;
}hfnode;
```
因为霍夫曼树每次建立一个新节点都要从需要编码的队列中找出最小的元素，所以，需要完成一个最小堆来减少时间消耗。只需要几个简单的集合操作即可:

- 堆的维护
``` C++
void
minHeapify(hfnode* a, int len, int i)
{
    int r = _Right(i);
    int l = _Left(i) ;
    int minimum;

    if (l < len && a[l-1].freq < a[i-1].freq)
        minimum = l;
    else
        minimum = i;

    if (r < len && a[r-1].freq < a[minimum-1].freq)
        minimum = r;

    if (minimum != i) {
        myswap(a[minimum-1], a[i-1]);

        minHeapify(a, len, minimum);
    }
}
```
- 建立堆
``` C++
void
buildHeap(hfnode* a, int len)
{

    for (int i = len/2; i >= 1; i--)
        minHeapify(a, len, i);
}
```
- 抽取最小值
``` C++
hfnode&
extractmin(hfnode* heap, int &len)
{
    myswap(heap[0], heap[len-1]);
    len--;
    minHeapify(heap, len, 1);
    return heap[len];
}
```
- 插入
``` C++
void
heapInsert(hfnode* heap, int &len, hfnode& z)
{
    heap[len++] = z;
    buildHeap(heap, len+1);
}
```
建立霍夫曼树的过程就是，首先尽量选频率小的元素作为叶子，然后分配一个新的节点作为它们的父节点，该父节点的频率值为子节点频率和，最后将该父节点重新放回最小堆，循环再次从堆中抽取两个最小值，形成下一个节点，依次类推知道得到最后的根节点，其频率应该为1。

实现如下：
``` C++
hfnode *
Huffmantranslations::buildHuffmanTree(hfnode arr[], int len)
{
    int n = len;

    for (int i = 1; i < n; i++) {
            hfnode x = extractmin(arr, len);
            hfnode y = extractmin(arr, len);
            hfnode *z = new hfnode;
            z->left = &x;
            z->right = &y;
            z->freq = x.freq + y.freq;
            heapInsert(arr, len, *z);
            printf("%d %d\n", x.freq, y.freq);
    }
    return &arr[0];
}
```


# 高级数据结构

## B树
B树主要的用途是用来进行优化磁盘操作，减少慢速设备和快速设备之间的速度差是很有必要的，所以在该算法中会有出现磁盘操作，虽然没有进行对应的操作，但是有必要知道什么时候进行读写，磁盘页只会在内存中留着极少数量。
性质：
1. 节点属性

   - x.n代表存储在节点x中的节点个数
   - x.key[i]以非降序排放
   - x.leaf判断是否为叶子节点
   - 有x.n+1个指针(x.c)指向该节点的孩子节点
2. 节点x.key[i]分割孩子节点的关键字
3. 每个节点的最大和最小关键字又最小度数(minumum degree)决定，最小度数为２时是最简单的Ｂ树，即２－３－４树。
   - 除了根节点，每个节点必须有t-1个关键字
   - 除了根节点，每个节点必须有t个孩子节点
   - 树非空，根节点必须要有关键字
   - 每个节点最多2t-1个关键字，即有2t个孩子节点

在实现过程中，自己有用到[算法可视化](https://www.cs.usfca.edu/~galles/visualization/BTree.html)进行辅助编写，但是里面的概念和书上有点不同，比如t=2时，应该选中max.degree=4，并且选中Preemtive Split优先分离选项。

首先是树的节点定义：
``` C++
typedef struct btreenode
{
    int n;  // the number of key
    bool leaf;
    /* both key and child pointer need to be allocated according to the value __n__ */
    struct btreenode **cp; // point to the child pointer
    void ** diskpage;
    char *key; // point to the key area
}bnode;
```

刚开始定义的时候，以为关键字大小是变化的，需要进行动态分配，实际上使用数组会方便很多，但是要提前知道度数。

然后是`创建B树的根节点`，二叉树是向下进行增长的，新的节点加入到叶子节点然后再进行其他的操作，而`Ｂ树是向上进行增长的`，所以，除了前面几个节点是叶子节点，并且所有的树高都是同样的。
``` C++
bnode*
Btree::BTree_Create()
{
    bnode* x = new bnode;
    x->leaf = true;
    x->n = 0;

    x->key = new char[2 * t - 1 + 1];
    x->cp = new bnode*[2 * t + 1]; // abort the first element of the array;

    DiskRead(x);
    root = x;
    return x;
}
```
然后是进行`插入操作`，但是在这之前需要完成一个分类节点的辅助函数，当一个节点的最大元素数量大于2t-1的时候，那么就需要进行分裂操作，将该节点变为两个各含t-1个元素的节点，并且将中间关键字提升到父节点去。
分列函数的实现:
``` C++
void
Btree::BTree_SplitChild(bnode *x, int i)
{

    bnode* z = Allocate_Node();
    bnode* y = (x->cp)[i];

    z->leaf = y->leaf;
    z->n = t-1;


    for (int j = 1; j <= t-1; j++)
        (z->key)[j] = (y->key)[j+t]; // j+t = j + (t-1) + 1


    if (y->leaf == false)
        for (int j = 1; j <= t; j++)
            (z->cp)[j] = (y->cp)[j+t];
    y->n = t-1;


    for (int j = x->n + 1; j >= i+1; j--)
        (x->cp)[j+1] = (x->cp)[j];
    (x->cp)[i+1] = z;

    for (int j = x->n; j >= i; j--)
        (x->key)[j+1] = (x->key)[j];
    (x->key)[i] = (y->key)[t];


    printf("split->[%c]\n", (x->key)[i]);
    x->n++;


    DiskWrite(x);
    DiskWrite(y);
    DiskWrite(z);
}
```

参数i的作用是定位孩子节点，(x->key)[i]是提升子节点关键字的位置，(y->key)[t]用t进行定位，得到需要被提升的关键字。除此之外，如果不是叶子情况，那么孩子节点都需要进行对应赋值。

然后开始`插入过程`：
``` C++
void
Btree::BTree_Insert(char key)
{

    bnode* r = root;
    if (r->n == 2 * t - 1) {
        bnode *s = Allocate_Node();
        root = s;
        s->leaf = false;
        s->n = 0;
        (s->cp)[1] = r;
        BTree_SplitChild(s,1);
        BTree_Insert_NONFULL(s, key);
    }
    else
        BTree_Insert_NONFULL(r, key);

}
```
因为Ｂ树是向上进行增长的，所以，分裂一般是在根节点发生的。比如，最小度数t=２的情况，根节点当插入了３个值准备进行第４个值的插入操作的时候，就会分配一个新的节点作为新的根节点，分裂，并且提升子关键字。

保证x.leaf正确性的理由是，从Insert函数分配的新根节点都是false值，但是在split函数中的是通过兄弟节点进行赋值才获取的值，也就是说，只有叶子节点的兄弟节点才是叶子节点。

完成这些准备后，才开始真正的`插入操作`过程：
``` C++
void
Btree::BTree_Insert_NONFULL(bnode *x, char k)
{

    int i = x->n;
    if (x->leaf == true) {

        while (i >= 1 && k < (x->key)[i]) {
            (x->key)[i+1] = (x->key)[i];
            i--;
        }

        printf("insert : %c\n", k);

        (x->key)[i+1] = k;
        x->n++;

        DiskWrite(x);

    } else {
        while (i >= 1 && k < (x->key)[i])
            i--;
        i += 1;

        DiskRead((x->cp)[i]);

        if ((x->cp)[i]->n == 2 * t - 1) {
            BTree_SplitChild(x, i);
            if (k > (x->key)[i]) // the new key comes from child node
                i += 1;
        }

        BTree_Insert_NONFULL((x->cp)[i], k);
    }
}
```
由此可见，插入函数是不断地把关键字插入到叶子节点去，如果某个叶子节点满了的话，那么就会分裂该节点并且，提升一个关键字到父节点，如果该父节点也满了，那么递归进行分裂。在执行分裂后有一个`小细节`，如果从子节点提升的关键字比ｉ小，那么就要把这个节点插入到这个节点的右孩子中去，所以ｉ执行了加１的操作。

然后是`删除操作`了：
书上没有给出删除操作的伪代码，但是给出了不同情况的解决办法，我以我的理解对这些情况进行了扩充：
1. 如果关键字ｋ在叶子节点ｘ中，`并且该节点的元素不少于t-1`，那么简单从ｘ中删除该关键字。
2. 如果关键字ｋ`在`内部节点ｘ中，那么分三种情况:
    - __a.__　如果该节点的左子节点包含大于等于`t`个关键字，那么可以从左子节点中找出前驱`k'`（最后一个元素）代替ｘ节点中的ｋ，然后递归删除左子节点中的`k'`。
    - __b.__　如果左子节点只含有`t-1`个关键字，那么从右子节点中找出后继`k'`（第一个元素），然后递归删除`k'`。
    - __c.__　如果左右子节点的关键字都是`t-1`个关键字，那么将`k`和右子节点都合并到左子节点，左子节点中的元素变为 2t-1　，然后释放右子节点并且递归删除`k`。
3. 如果不在内部节点ｘ（叶子节点）中，那么需要在子节点中去删除,又可以分成两种情况：
   - __a.__　如果孩子节点只有ｔ-1个关键字，但是`前一个或者后一个子节点`拥有至少`t`个关键字，那么就需要借一个关键字，也就是ｘ中的关键字`k1`下降到孩子节点中，然后从其他子节点中去偷取一个关键字`k2`，并且删除原来的`k2`关键字。
   - __b.__　如果相邻的子节点也都是只含有`t-1`关键字，那就要进行合并存在`k`的节点和任意一个节点，并且从`x`中下降一个关键字到新节点去，然后再简单删除关键字`k`。

下面是`删除操作`的实现：
``` C++


int
Btree::BTree_Delete(bnode* x, char k)
{
    int j = 1;
    // find k;
    while (j <= x->n && k > (x->key)[j])
        j++;

    /** case 1: key 'k' is in the node x, and node x is a leaf node*/

    if (x->leaf && x->n > t-1) {
        printf("case 1\n");
        j += 1;
        // left shift
        while (j <= x->n) {
            (x->key)[j-1] = (x->key)[j];
            j++;
        }
        x->n--;
        // set nil
        while ((j-1) < 2 * t ) {
            (x->key)[j-1] = 0;
            j++;
        }
        printf("remove [%c]\n", k);
        DiskWrite(x);
        return 0;

    } else if (k == (x->key)[j] && !(x->leaf)) {


    /** case 2: node x is not a leaf node, it need keep the number of elements greater than t-1*/

        bnode* y = (x->cp)[j];
        bnode* z = (x->cp)[j+1];

        DiskRead(y);
        DiskRead(z);


        if (y->n >= t) {


    /** case 2a: y node >= t-1 + 1, the precursor replaces the x->key.*/


            printf("precursor: %c\n", (y->key)[y->n]);
            (x->key)[j] = (y->key)[y->n];
            BTree_Delete(y, (y->key)[y->n]);


        } else if (z->n >= t) {


    /** case 2b: z node >= t-1 +1, the successor replaces the x->key.*/


            printf("successor: %c\n", (z->key)[1]);
            (x->key)[j] = (z->key)[1];
            BTree_Delete(z, (z->key)[1]);


        } else {


    /** case 2c: both y and z don't have extra key, merge k and z into node
    y, and simply delete k in the node z finally.*/
            printf(" case 2c  \n");
            int i;

            //merge k into y
            (y->key)[y->n+1] = k;
            y->n += 1;

            //merge node z into y
            for (i = 1; i <= t-1; i++)
                (y->key)[y->n+i] = (z->key)[i];
            for (i = 1; i <= t; i++)
                (y->cp)[y->n+i+1] = (z->cp)[i];
            y->n = 2 * t - 1;
            delete z;
            //deleting key is in the node x
            for (i = j; i <= x->n; i++)
                (x->key)[i] = (x->key)[i+1];
            (x->key)[x->n] = 0;
            for (i = j+1; i <= x->n+1; i++)
                (x->cp)[i] = (x->cp)[i+1];
            (x->key)[x->n+1] = NULL;
            x->n--;

            if (x->n == 0) {
                delete x;
                root = y;
            }

            //deleting key is in the node y
            BTree_Delete(y, k);


            DiskWrite(y);
            DiskWrite(z);
        }
    } else {
            /** case 3: the key isn't in the node, it need to
            recursively find the corresponding key */


            printf("case 3 \n");
            bnode *ch;
            int r;

            //find the node recursively
            if (k != (x->key)[j])
            {
                // it will return when the node
                // does have the key.

                ch = (x->cp)[j];

                r = BTree_Delete(ch, k);
                if (r == 0)
                    return 0;
            } else
                return j;



            bnode* pre = (x->cp)[j-1];
            bnode* nxt = (x->cp)[j+1];

            DiskRead(ch);
            DiskRead(pre);
            DiskRead(nxt);

            printf("p: %p\n", nxt);

            /** case 3a: node doesn't have enough key,
            steeling key from brother node */
            if (pre && pre->n >= t) {

                printf("case 3a1\n");
                for (int i = r; i > 1; i--)
                    (ch->key)[i] = (ch->key)[i-1];

                (ch->key)[1] = (x->key)[j-1];

                (x->key)[j-1] = (pre->key)[pre->n];
                BTree_Delete(pre, (pre->key)[pre->n]);
                DiskWrite(ch);
                DiskWrite(pre);

            } else if (nxt && nxt->n >= t) {

                printf("case 3a2\n");
                for (int i = r; i < nxt->n; i++)
                    (ch->key)[i] = (ch->key)[i+1];


                (ch->key)[nxt->n] = (x->key)[j];

                (x->key)[j] = (nxt->key)[1];
                BTree_Delete(nxt, (nxt->key)[1]);
                DiskWrite(ch);
                DiskWrite(nxt);
            } else {

                /** case 3b: both of the brother node haven't
                enough key, steeling key from the parent node*/

                printf("case 3c\n");

                for (int i = r; i < (t-1)+1-1; i++)
                        (ch->key)[i] = (ch->key)[i+1];
                if (pre == NULL) { //merge next child node

                    (ch->key)[t] = (x->key)[j];
                    for (int i = 1; i <= t-1; i++)
                        (ch->key)[i+t] = (nxt->key)[i];
                    delete nxt;
                    BTree_Delete(x, (x->key)[j]);
                    DiskWrite(ch);
                } else { // merge previous node

                    (pre->key)[t] = (x->key)[j-1];
                    for (int i = 1; i <= t-1-1; i++)
                        (pre->key)[i+t] = (ch->key)[i];
                    delete ch;
                    BTree_Delete(x, (x->key)[j-1]);
                    DiskWrite(pre);

                }



            }
            return 0;


        }



}
```

对应情况１，`x->leaf && x->n > t-1`保证是删除的叶子节点，并且能够进行简单删除。对应情况２，`k == (x->key)[j] && !(x->leaf)`保证关键字是在节点ｘ内的，并且是个内部节点。情况３用来处理删除叶子节点的关键字，但是没有额外关键字的情况。

写完后发现，实现删除操作的代码过长了，占了200行左右，后来写博客进行总结的时候，发现删除操作和插入操作存在逆向的过程，插入的过程有`分裂`，而删除的过程有`合并`的过程，应该可以重写以上代码，分离出一个合并的过程。
