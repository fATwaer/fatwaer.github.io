---
title: "Leetcode: backtrace 专题"
date: 2021-05-18T22:34:21+08:00
draft: false
---

## 全排列 

``` cpp
class Solution {
public:
    vector<vector<int>> res;
    vector<int> state;
    void dfs(int k, int n, int idx, int sum) {
        for (int i = idx; i <= 9; ++i) {
            state.push_back(i);
            sum += i;
            if (state.size() == k && sum == n) {
                res.push_back(state);
            } else if (sum < n) {
                dfs(k, n, i+1, sum);
            }
            sum -= i;
            state.pop_back();
        }
    }

    vector<vector<int>> combinationSum3(int k, int n) {
        dfs(k, n, 1, 0);
        return res;
    }
};
```

简单回溯。