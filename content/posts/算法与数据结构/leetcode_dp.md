---
title: "Leetcode: dp 专题"
date: 2021-08-22T23:51:21+08:00
draft: false
---

## 前言

我使用二级标题来记录题号和题名，后面括号内的内容代表耗时和内存超过了多少人，如果数值比较低代表这道题目还是有研究空间。

比如 `(51c, 72m)` 代表耗时(consume) 超过了 51% 的人和内存占用(memory) 超过了 72%，很明显，还有更高效率的算法设计可以学习。

## 89. 房屋偷窃

``` cpp
class Solution {
public:
    int rob(vector<int>& nums) {
        vector<vector<int>> dp(nums.size(), vector<int>(2, 0));
        dp[0][0] = nums[0];
        dp[0][1] = 0;
        for (int i = 1; i < nums.size(); ++i) {
            dp[i][0] = dp[i-1][1] + nums[i];
            dp[i][1] = std::max(dp[i-1][1], dp[i-1][0]);
        }
        return std::max(dp[nums.size()-1][0], dp[nums.size()-1][1]);
    }
};
```
0 代表偷窃，1 代表不偷窃。

## 090. 环形房屋偷盗
``` cpp
class Solution {
public:
    int rob(vector<int>& nums) {
        if (nums.size() == 1) return nums[0];
        if (nums.size() == 2) return std::max(nums[0], nums[1]);
        vector<vector<int>> dp(nums.size(), vector<int>(2, 0));
        dp[1][0] = nums[1];
        dp[1][1] = nums[0];
        for (int i = 2; i < nums.size()-1; ++i) {
            dp[i][0] = dp[i-1][1] + nums[i];
            dp[i][1] = std::max(dp[i-1][1], dp[i-1][0]);
        }
        int max1 = std::max(dp[nums.size()-2][0], dp[nums.size()-2][1]);
        dp[1][0] = nums[1];
        dp[1][1] = 0;
        for (int i = 2; i < nums.size(); ++i) {
            dp[i][0] = dp[i-1][1] + nums[i];
            dp[i][1] = std::max(dp[i-1][1], dp[i-1][0]);
        }
        int max2 = std::max(dp[nums.size()-1][0], dp[nums.size()-1][1]);
        return std::max(max1, max2);
    }
};
```
在89题的基础上进行分情况讨论，分别是偷窃 1 ~ n-1 和 2 ~ n。

## 123. 买卖股票的最佳时机 III
``` cpp
class Solution {
public:
    int maxProfit(vector<int>& prices) {
        using std::max;
        vector<vector<int>> dp (prices.size(), vector<int>(4, 0));
        dp[0][0] = -1 * prices[0];
        dp[0][2] = -1 * prices[0];
        for (int i = 1; i < prices.size(); ++i) {
            dp[i][0] = max(dp[i-1][0], -prices[i]);
            dp[i][1] = max(dp[i-1][1], dp[i-1][0] + prices[i]);
            dp[i][2] = max(dp[i-1][2], dp[i-1][1] - prices[i]);
            dp[i][3] = max(dp[i-1][3], dp[i-1][2] + prices[i]);
        }
        return dp[prices.size()-1][3];
    }
};
```
`dp[i][0]~dp[i][3]` 依次代表持有第一支股票的最高收益，卖出第一支的最高收益，持有第二支的最高收益，卖出第二支的最高收益。
这道题要注意 `dp[0][2]` 的初始化，对于 `1,2,3,4,5` 这种情况，卖出后再买入的第二支持有收益肯定是负，不能初始化为 `0`。

## 121. 买卖股票的最佳时机

``` cpp
class Solution {
public:
    int maxProfit(vector<int>& prices) {
        std::vector<int> dp(prices.size(), 0);
        if (prices.size() == 0) return 0;
        int min_price = prices[0];
        for (int i = 1; i < prices.size(); ++i) {
            min_price = std::min(min_price, prices[i]);
            dp[i] = std::max(dp[i-1], prices[i] - min_price);
        }
        return dp[prices.size()-1];
    }
};
```

状态转移方程：`dp[i]=max(dp[i−1],prices[i]−minprice)`

## 53. 最大子序列和
``` cpp
class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        vector<int> dp(nums.size());
        dp[0] = nums[0];
        int max_sum = nums[0];
        for (int i = 1; i < nums.size(); ++i) {
            dp[i] = std::max(dp[i-1] + nums[i], nums[i]);
            max_sum = std::max(max_sum, dp[i]);
        }
        return max_sum;
    }
};
```

状态转移的时候，如果当前的值加上前面的字符串序列让和降低了，那么就重新开始计算。

## 122. 买卖股票的最佳时机 II

``` cpp
class Solution {
public:
    int maxProfit(vector<int>& prices) {
        vector<vector<int>> dp(prices.size(), vector<int>(2));
        dp[0][0] = -prices[0];
        dp[0][1] = 0;
        for (int i = 1; i < prices.size(); ++i) {
            dp[i][0] = std::max(dp[i-1][1] - prices[i], dp[i-1][0]);
            dp[i][1] = std::max(dp[i-1][0] + prices[i], dp[i-1][1]);
        }
        return dp[prices.size()-1][1];
    }
};
```

如果 i 天可以买股票，前一天就需要卖出股票，也就是 `dp[i-1][1]`。
如果 i 天可以卖股票，那前一天需要持有股票，也就是 `dp[i-1][0]`。


## 62. 不同路径
``` cpp
class Solution {
public:
    int uniquePaths(int m, int n) {
        vector<vector<int>> dp(m, vector<int>(n));
        for (int i = 0; i < m; ++i)
            dp[i][0] = 1;
        for (int i = 0; i < n; ++i)
            dp[0][i] = 1;
        
        for (int i = 1; i < m; ++i) {
            for (int j = 1; j < n; ++j) {
                dp[i][j] = dp[i][j-1] + dp[i-1][j]; 
            }
        }
        return dp[m-1][n-1];
    }
};
```

1、边上的位置只有一种方法走到，注意一下dp的初始。

2、状态转移为 `dp[i][j] = dp[i][j-1] + dp[i-1][j]`


## 63. 不同路径


``` cpp
class Solution {
public:
    int uniquePathsWithObstacles(vector<vector<int>>& obstacleGrid) {
        if (obstacleGrid.size() == 0 || obstacleGrid[0].size() == 0) return 0;
        int m = obstacleGrid.size();
        int n = obstacleGrid[0].size(); 
        vector<vector<int>> dp(m, vector<int>(n));
        for (int i = 0; i < m && obstacleGrid[i][0] != 1; ++i)
            dp[i][0] = 1;
        for (int i = 0; i < n && obstacleGrid[0][i] != 1; ++i)
            dp[0][i] = 1;
        for (int i = 1; i < m; ++i) {
            for (int j = 1; j < n; ++j) {
                if (obstacleGrid[i][j] == 1)
                    continue;
                dp[i][j] = dp[i-1][j] + dp[i][j-1];
            }
        }
        return dp[m-1][n-1];
    }
};
```

## 回文子串

``` cpp
class Solution {
public:
    string longestPalindrome(string s) {
        int n = s.size();
        if (n == 1) return s;
        std::vector<std::vector<bool>> dp(n, std::vector<bool>(n, false));
        for (int i = 0; i < n; ++i) {
            dp[i][i] = true;
        }
        int max_len = 1;
        int last_begin = 0;
        for (int len = 2; len <= n; len++) {
            // i(max) = (i + len) - 1 < n
            //        = i < n - len + 1
            for (int i = 0; i < n - len + 1; ++i) {
                int left = i;
                int right = i + len - 1;
                if (len == 2 && s[left] == s[right]) {
                    dp[left][right] = true;
                    max_len = len;
                    last_begin = left;
                    continue;
                }
                if (s[left] == s[right] && s[left+1] == s[right-1]) {
                    dp[left][right] = dp[left+1][right-1];
                    if (dp[left][right]) {
                        max_len = len;
                        last_begin = left;
                    }
                }
            }
        }
        return s.substr(last_begin, max_len);
    }
};
```

这题的做法是不断地增长长度，看是否可以找到最长的回文串。

`dp[left][right] = dp[left+1][right-1];` 如果(left,right)的两端相等，那么同时缩短后的两端也是相等的。

边界情况有两种：
1. left = right 的时候，也就是 len = 1 的时候，肯定是回文串
2. len = 2 的时候，比如 `abb => (left=1,right=2)`，他们递推的前一个是 `(left=2,right=1)`，在dp数组里面是不会被初始化的，所以要单独初始化。


``` cpp
class Solution {
public:
    pair<int, int> expand(string s, int left, int right) {
        while (left >= 0 && right < s.size() && s[left] == s[right]) {      
            ++right;
            --left;
        }
        return {left + 1, right - (left+1)};
    }
    string longestPalindrome(string s) {
        int beg = 0, len = 0;
        for (int i = 0; i < s.size(); ++i) {
            auto [left1, len1] = expand(s, i, i);
            auto [left2, len2] = expand(s, i, i+1);
            if (len1 > len) {
                beg = left1;
                len = len1;
            }
            if (len2 > len) {
                beg = left2;
                len = len2;
            }
        }
        return s.substr(beg, len);
    }
};
```

中心扩散：利用边界条件推导，并且用expand函数来确定检查扩散逻辑。


// todo: Manacher(马拉车)算法

## 10. 正则表达式匹配

``` cpp
class Solution {
public:
    bool isMatch(string s, string p) {
        int m = s.size();
        int n = p.size();
        vector<vector<bool>> dp(m+1, vector<bool>(n+1, false));

        auto match = [&](int i, int j) -> bool {
            if (i == 0) {
                return false;
            }
            if(p[j-1] == '.') {
                return true;
            }
            return s[i-1] == p[j-1];
        };
        dp[0][0] = true;
        for (int i = 0; i <= m; ++i) { // 以 i 长度结尾的字符串
            for (int j = 1; j <= n; ++j) {
                if (p[j-1] == '*') {
                    if (match(i, j-1)) {
                        dp[i][j] = dp[i-1][j] || dp[i][j-2];     
                    } else {
                        dp[i][j] = dp[i][j-2];
                    }
                } else {
                    if (match(i, j))
                        dp[i][j] = dp[i-1][j-1];
                }
            }
        }
        return dp[m][n];
    }
};
```

状态转移方程：把 `abc*d` 中的 `c*d` 合为一体就比较好考虑了，比如要匹配的数据是 `abd`，这两个数据把 d 比较完成后，比较就是匹配 `ab` 和 `ab(c*)`

初始化：其实这道题的难点我觉得在初始化部分，就是当 i（字符串的长度）等于0的时候，是执行可以匹配的，才可以作为后面推导的基础，所以把dp数组的大小扩大了1圈。

边界：主要考虑下面这种情况，如果`p[j-1] == ‘*’ && match(i, j-1) == false` 的情况，这种情况下还是能递推完全没有`(c*)`的这种情况。

``` cpp
if (p[j-1] == '*') {
    if (match(i, j-1)) {

    }
}
```

## 368. 最大整除子集 (51c,72m)

``` cpp
class Solution {
public:
    vector<int> largestDivisibleSubset(vector<int>& nums) {
        std::sort(nums.begin(), nums.end());
        vector<int> dp(nums.size()+1, 0);
        dp[0] = 0;
        int max_len = 0;
        int max_value = 0;
        for (int i = 1; i <= nums.size(); ++i) {
            // dp[i] 为以第 i 个数结尾的最大整除子集的大小
            for (int j = i; j > 0; --j) {
                if (nums[i-1] % nums[j-1] == 0) {
                    dp[i] = std::max(dp[j] + 1, dp[i]);
                }
            }
            if (max_len < dp[i]) {
                max_len = dp[i];
                max_value = nums[i-1];
            }
        }
        vector<int> res;
        for (int i = dp.size()-1; i > 0; --i) {
            if (dp[i] == max_len && max_value % nums[i-1] == 0 && max_len > 0) {
                res.push_back(nums[i-1]);
                max_value = nums[i-1];
                --max_len;
            }
        }
        return res;
    }
};
```

1. 排序，使后面的值能够循环处理整除
2. 记录最大值和最大子集大小，用于推导最终结果。


## 983. 最低票价 (100c, 76m)

``` cpp
class Solution {
public:
    int mincostTickets(vector<int>& days, vector<int>& costs) {
        int total_days = days[days.size()-1];
        vector<int> dp(total_days+1, 0);
        int travel_day_idx = 0;
        for (int i = 1; i <= total_days; ++i) {
            if (days[travel_day_idx] != i) {
                dp[i] = dp[i-1];
            } else {
                int cost = INT_MAX;
                cost = min(dp[max(i-1, 0)] + costs[0], cost);
                cost = min(dp[max(i-7, 0)] + costs[1], cost);
                cost = min(dp[max(i-30, 0)] + costs[2], cost);
                dp[i] = cost;
                travel_day_idx++;
            }
        }
        return dp[total_days];
    }
};
```

1. 和前几天关联的时候不要用这种方式，因为天数不够也是能买多天的票的，比如7天的票2元，1天的票7元这种case就会过不了。
    ``` cpp
    if (i >= 1) cost = min(dp[min(i-1, 0)] + costs[0], cost);
    if (i >= 7) cost = min(dp[min(i-7, 0)] + costs[1], cost);
    if (i >= 30) cost = min(dp[min(i-30, 0)] + costs[2], cost);
    ```
2. dp 方程的解释：`dp[i]` 为第i天最小的出行开销，找到1，7，30天前最小的开销就好，如果某天不出行，开销和前天保持一致。


## 64. 最小路径和 (80c, 49m)

``` cpp
class Solution {
public:
    int minPathSum(vector<vector<int>>& grid) {
        int m = grid.size();
        int n = grid[0].size();
        vector<vector<int>> dp(m, vector<int>(n, 0));

        dp[0][0] = grid[0][0];
        for (int i = 1; i < n; ++i) {
            dp[0][i] = dp[0][i-1] + grid[0][i];
        }
        for (int i = 1; i < m; ++i) {   
            dp[i][0] = dp[i-1][0] + grid[i][0];
        } 
         
        for (int i = 1; i < m; ++i) {
            for (int j = 1; j < n; ++j) {
                dp[i][j] = std::min(dp[i][j-1], dp[i-1][j]) + grid[i][j];
            }
        }
        return dp[m-1][n-1];
    }
};
```

和不同路径一题一样的解法，初始化+定义转移方程即可解出来。


## 095. 最长公共子序列 (57c,56m)

``` cpp
class Solution {
public:
    int longestCommonSubsequence(string text1, string text2) {
        int m = text1.size();
        int n = text2.size();
        vector<vector<int>> dp(m+1, vector<int>(n+1, 0));

        for (int i = 1; i <= m; ++i) {
            for (int j = 1; j <= n; ++j) {
                if (text1[i-1] == text2[j-1]) {
                    dp[i][j] = dp[i-1][j-1] + 1;
                } else {
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1]);
                }
            }
        }
        return dp[m][n];
    }
};
```

经典问题：`dp[i][j]` 的定义为第 i 和第 j 结尾的字符的最小子序列长度。

## 1092. 最短公共超序列(34c,31m)

``` cpp
class Solution {
public:
    string shortestCommonSupersequence(string str1, string str2) {
        int m = str1.size();
        int n = str2.size();
        vector<vector<string>> dp(m+1, vector<string>(n+1));
        for (int i = 1; i <= m; ++i) {
            for (int j = 1; j <= n; ++j) {
                if (str1[i-1] == str2[j-1]) {
                    dp[i][j] = dp[i-1][j-1] + str1[i-1];
                } else {
                    int l1 = dp[i-1][j].size();
                    int l2 = dp[i][j-1].size();
                    if (l1 > l2) dp[i][j] = dp[i-1][j];
                    else         dp[i][j] = dp[i][j-1];
                }
                // std::cout << "[" << dp[i][j] << "] ";
            }
            // std::cout << std::endl;
        }
        // return dp[m][n];
        string lcs = dp[m][n];
        int p1 = 0, p2 = 0;
        string scs;
        for (auto c : lcs) {
            while (p1 < m && str1[p1] != c) {
                scs += str1[p1];
                ++p1;
            }
            while (p2 < n && str2[p2] != c) {
                scs += str2[p2];
                ++p2;
            }
            scs += c;
            ++p1;
            ++p2;
        }
        scs += str1.substr(p1);
        scs += str2.substr(p2);
        return scs;
    }
};
```

1. 通过 LCS 得到最长公共子序列
2. 公共子序列的每一个字符是一个关键节点，相当于一个栅栏，两个序列在这个点同步了，先把公共节点前面的处理完，追加公共节点，再依此类推，最后再追加一下在公共子序列后面的字符。

## 72. 编辑距离(20c, 19m)

``` cpp
class Solution {
public:
    int minDistance(string word1, string word2) {
        int m = word1.size();
        int n = word2.size();
        vector<vector<int>> dp(m+1, vector<int>(n+1, 0));
        for (int i = 0; i <= m; ++i) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= n; ++j) {
            dp[0][j] = j;
        }

        for (int i = 1; i <= m; ++i) {
            for (int j = 1; j <= n; ++j) {
                if (word1[i-1] == word2[j-1]) {
                    dp[i][j] = dp[i-1][j-1];
                } else {
                    dp[i][j] = std::min(dp[i-1][j-1], min(dp[i-1][j], dp[i][j-1])) + 1;
                }
            }
        }
        return dp[m][n];
    }
};
```
题目中要注意的点：
1、word1和word2都是可以修改的。
2、给word1追加一个字符和给word2删除一个字符是等价的。

定义 `dp[i][j]` 为 word1 前i个元素和 word2 的前j个元素最小需要的变化操作数量。

状态转移：

如果 `word1[i] = word2[j]`：

`dp[i][j] = dp[i-1][j-1]`

否则：

给 word1 追加：`dp[i][j-1]+1`，追加的字符补充在 word1 后面，即`word1[i+1] = word2[j]`，所以 `word1[0:i]` 需要和 `word2[0:j-1]` 相等。
给 word2 追加：`dp[i-1][j]+1`
给 word1 替换：`dp[i-1][j-1]+1`，替换使得 `word1[i] = word2[j]`，(i, j) 前面的操作次数加1即可。

并且取最小值即可。

最后初始化部分：一个字符串变成空串操作次数为字符串的长度。



## 72. 编辑距离(100c, 93m)

``` cpp
class Solution {
public:
    int minDistance(string word1, string word2) {
        int m = word1.size();
        int n = word2.size();
        // A
        if (m*n == 0) return n+m;
        // B
        // vector<vector<int>> dp(m+1, vector<int>(n+1, 0));
        int dp[m+1][n+1];       
        for (int i = 0; i <= m; ++i) {
            dp[i][0] = i;
        }
        for (int j = 0; j <= n; ++j) {
            dp[0][j] = j;
        }

        for (int i = 1; i <= m; ++i) {
            for (int j = 1; j <= n; ++j) {
                if (word1[i-1] == word2[j-1]) {
                    dp[i][j] = dp[i-1][j-1];
                } else {
                    dp[i][j] = std::min(dp[i-1][j-1], min(dp[i-1][j], dp[i][j-1])) + 1;
                }
            }
        }
        return dp[m][n];
    }
};
```

前一种解法耗时和内存都很高，对比提交记录里面更加快速的答案，看到有几个优化点：

- A：如果任意一个是空串，那返回另外一个的长度即可。
- B：`dp[i][j]` 的值由子结构确定，不需要和自己比较，不用走 memset 之类的初始化也可以得到最终的结果。


## 97. 交错字符串(79c, 57m)

``` cpp
class Solution {
public:
    bool isInterleave(string s1, string s2, string s3) {
        int m = s1.size();
        int n = s2.size();
        
        if (m + n != s3.size())  return false;
        vector<vector<bool>> dp (m+1, vector<bool>(n+1, false));

        dp[0][0] = true;
        for (int i = 1; i <= m; ++i) {
            dp[i][0] = (s3[i-1] == s1[i-1] && dp[i-1][0]);
        }
        for (int j = 1; j <= n; ++j) {
            dp[0][j] = (s3[j-1] == s2[j-1] && dp[0][j-1]);
        }

        // i + j 是否能交错成非空
        for (int i = 1; i <= m; ++i) {
            for (int j = 1; j <= n; ++j) {
                if (s3[i+j-1] == s1[i-1] && dp[i-1][j] != false) {
                    dp[i][j] = true;
                }
                if (s3[i+j-1] == s2[j-1] && dp[i][j-1] != false) {
                    dp[i][j] = true;
                }
            }  
        }
        return dp[m][n];
    }
};
```

1、单纯双指针是不行的，因为s1/s2同时碰到相同的字符的时候，选错指针移动就会错过合适的序列，除非加上回溯和其他方法。
2、dp 状态定义为，`s1[0:i]` 和 `s2[0:j]` 是否能交错成 `s3[0:i+j]` 的字符串，再关联 `dp[i][j]` 和前面一个子问题的关系，并且处理好初始化即可。