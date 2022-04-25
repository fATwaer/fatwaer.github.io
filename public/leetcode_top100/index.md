# Leetcode: top100


leetcode top100题中的数组tag：<https://leetcode-cn.com/problem-list/2cktkvj/>

## 15. 三数之和

``` c++
class Solution {
public:
    vector<vector<int>> threeSum(vector<int>& nums) {
        vector<vector<int>> res;
        std::sort(nums.begin(), nums.end());
        for (int i = 0; i < nums.size(); ++i) {
            int first = nums[i];
            if (first > 0) {
                continue;
            }
            if (i > 0 && nums[i-1] == first) {
                continue;
            }
            int target = -1 * first;
            int j = i + 1;
            int k = nums.size() - 1;
            while (j < k) {
                int second = nums[j];
                int third = nums[k];
                if (second + third > target) {
                    k--;
                    continue;
                } else if (second + third < target) {
                    j++;
                    continue;
                } else {
                    res.emplace_back(std::vector<int>({first, second, third}));
                    ++j;
                    --k;
                    while (j < k && nums[j] == nums[j-1]) ++j;
                    while (j < k && nums[k] == nums[k+1]) --k;
                }
            }
        }
        return res;
    }
    
};
```
题目的注意事项是：不包含重复的三元组，暴力去解决还需要set来去重，特别麻烦。

解法应该是将三数和转化为两数和的问题，排序+双指针。

注意：
1. 因为是递增序列，如果第一个不是负数，那后面相加肯定不可能等于0
2. 找到target后，用双指针移动不断找到两个合适的值，并且要用移动指针去重。


## 39. 组合总和

``` c++
class Solution {
public:
    void search(vector<vector<int>>& res,
                vector<int>& candidates, 
                int target, 
                int idx, 
                std::vector<int>& combine) {
        if (target == 0) {
            res.emplace_back(std::vector<int>(combine.cbegin(), combine.cend()));
            return;
        }
        if (idx >= candidates.size() || target < 0) {
            return;
        }

        // 选择自己
        combine.push_back(candidates[idx]);
        search(res, candidates, target - candidates[idx], idx, combine);
        combine.pop_back();

        // 选择下一个
        if (idx + 1 < candidates.size()) {
            search(res, candidates, target, idx+1, combine);
        }
    }

    vector<vector<int>> combinationSum(vector<int>& candidates, int target) {
        // std::list<int> combine;
        std::vector<int> combine;
        vector<vector<int>> res;
        search(res, candidates, target, 0, combine);
        return res;
    }
};
```

搜索问题可以先画一颗树来解决问题。（vector比list快）

保存当前的状态再进去求子问题，并且保证能够恢复到递归前的状态。

比如跳过了当前数字，就不要保存状态了。



## 40. 组合总和II

``` c++
class Solution {
public:
void search(vector<vector<int>>& res,
                vector<int>& candidates, 
                int target, 
                int idx, 
                std::vector<int>& combine) {
        if (target == 0) {
            res.emplace_back(std::vector<int>(combine.cbegin(), combine.cend()));
            return;
        }
        if (idx >= candidates.size() || target < 0) {
            return;
        }

        // 选择自己
        if (target - candidates[idx] >= 0) {
            combine.push_back(candidates[idx]);
            search(res, candidates, target - candidates[idx], idx+1, combine);
            combine.pop_back();
        }

        // 选择下一个
        ++idx;
        while(idx < candidates.size()) {
            if (candidates[idx] != candidates[idx-1]) {
                search(res, candidates, target, idx, combine);
                break;
            }
            ++idx;
        }
    }

    vector<vector<int>> combinationSum2(vector<int>& candidates, int target) {
        std::vector<int> combine;
        std::sort(candidates.begin(), candidates.end());
        vector<vector<int>> res;
        search(res, candidates, target, 0, combine);
        return res;
    }
};
```

39题的变种题，40题因为数字只能选一次，而且有重复数字，所以会出现重复结果集。

去重和3sum问题类似，先排序，排序解决的问题是当选中当前数字搜索完后，就能跳到下个不重复的数字（剪枝）。


## 46. 全排列
``` c++
class Solution {
public:
    void search(vector<int>& nums, vector<vector<int>>& res, 
                vector<int>& state, int idx) {

        for (int i = idx; i < nums.size(); ++i) {
            std::swap(nums[idx], nums[i]);
            state.push_back(nums[idx]);
            if (idx+1 == nums.size()) {
                res.push_back(state);
            } else {
                search(nums, res, state, idx+1);
            }
            state.pop_back();
            std::swap(nums[idx], nums[i]);
        }
    }
    vector<vector<int>> permute(vector<int>& nums) {
        vector<vector<int>> res;
        vector<int> state;
        state.reserve(nums.size());
        search(nums, res, state, 0);
        return res; 
    }
};
```

全排列也是一道回溯的题目，回溯就可以理解为是不断地从集合里面挑选东西，然后不断试错找到结果，但是要能在继续找结果前保存状态，找完后恢复状态。

全排列这里保存状态有一个小技巧就是用swap交换来切换要选的数字，省去了一些繁琐的保存可选集合的复杂度。

## 46. 全排列 II

``` cpp
class Solution {
public:
    void print(std::vector<int>& state) {
        for (auto v : state) {
            std::cout << v << " ";
        }
    } 
    void search(vector<int>& nums, vector<vector<int>>& res, 
                vector<int>& state, int idx,
                vector<bool>& visited) {
        for (int i = 0; i < nums.size(); ++i) {
            if (visited[i] || (i > 0 && nums[i-1] == nums[i] && !visited[i-1])) {
                continue;
            }
            state.push_back(nums[i]);
            visited[i] = true;
            if (idx+1 == nums.size()) {
                res.emplace_back(std::vector<int>(state));
            } else {
                search(nums, res, state, idx+1, visited);
            }
            visited[i] = false;
            state.pop_back();
        }
    }
    vector<vector<int>> permuteUnique(vector<int>& nums) {
        vector<vector<int>> res;
        vector<int> state;
        vector<bool> visited(nums.size());
        std::sort(nums.begin(), nums.end());
        state.reserve(nums.size());
        search(nums, res, state, 0, visited);
        return res; 
    }
};
```

因为 swap 发生了变化，会导致排序剪枝不可用，相同元素在一块这个条件被打破了。

所以需要一个 visited 的记忆数组来判断选过没有，并且确定每次要选的条件，每层的 search 的循环都是在选一个合适的数字。

- 这个数字在其他选择的时候没有被选择过
- `同一层` 跳过相同的选择 `i > 0 && nums[i-1] == nums[i]&& !visited[i-1]` 这个追加的条件就是让同层在循环的时候指选择一次相同的数字。（假如序列是 1a,1b,1c,2b; 当同一层的1a用过了之后，会回溯状态到未使用的状态，也就是未visted。1b想挑选只能在1a已经被挑选的情况下使用）

另外，在回溯的问题中，idx 变量可以理解为选择第 k 个数字。

## 31. 下一个排列


``` cpp
class Solution {
public:
    void nextPermutation(vector<int>& nums) {
        int left_idx = nums.size()-2;
        while (left_idx >= 0 && nums[left_idx] >= nums[left_idx+1]) left_idx--;

        if (left_idx >= 0) {
            int left = nums[left_idx];
            for (int i = nums.size()-1; i >= left_idx; --i) {
                if (nums[i] > left) {
                    std::swap(nums[left_idx], nums[i]);
                    break;
                }
            }
        }

        std::reverse(nums.begin() + left_idx + 1, nums.end());
    }
};
```

这题的思路和全排列不是一种类型，全排列是回溯类型的题目，而这题是数字找规律。

要找到最右的最小数，和右边的大于最小数的值交换，然后反转原最小数右边的序列。

找最小数的过程是要从左往右找到 `nums[left_idx] < nums[left_idx+1]`，是因为我们需要找到一个最靠右边的小数能够交换就好了。只要小于一个值的原因是从右边往左搜保证了单调性。比如`1 2 5 4 3`，5 > 4 那么 5 肯定大于 3，而只需要 2 小于 5 就能保证 2 能够和后面的数字发生交换。

交换完 reverse 的原因其实是相当于从小到大 sort 了一下。但是因为具有单调性，所以reverse一下就能达到效果。

算法的实现有些 trick，利用 i 在搜不到的情况下等于 -1，就能处理入参为最后一个排列的情况（回到完全升序排列的情况）。
 
## 77. 组合

``` cpp
class Solution {
public:
    void dfs(vector<vector<int>>& res, int n, int idx, int k, vector<int>& state) {
        // for (int i = idx; i <= n; ++i) {
        for (int i = idx; i <= n - k + 1 + state.size() ; ++i) {
            state.push_back(i);
            if (state.size() == k) {
                res.push_back(state);
            } else {
                dfs(res, n, i+1, k, state);
            }
            state.pop_back();
        }
    }
    vector<vector<int>> combine(int n, int k) {
        vector<vector<int>> res;
        vector<int> state;
        dfs(res, n, 1, k, state);
        return res;
    }
};
```
不断选择所有结果即可，但是存在剪枝的条件。`n - k + 1` 是没有一个数字的情况可以减去的枝，比如`1 2 3 4 5 6 7, k = 4`， i 就不能等于5了。
再补上当前持有的数字，就是剪枝条件。


## 78. 子集合

``` cpp
class Solution {
public:
    void dfs(vector<vector<int>>& res, vector<int>& state, vector<int>& nums, int idx) {
        if (idx == nums.size()) {
            res.push_back(state);
            return;
        }
        
        state.push_back(nums[idx]);
        dfs(res, state, nums, idx+1);
        state.pop_back();
        
        dfs(res, state, nums, idx+1);
    }
    vector<vector<int>> subsets(vector<int>& nums) {
        vector<vector<int>> res;
        vector<int> state;
        dfs(res, state, nums, 0);
        return res;
    }
};
```

简单回溯。


## 90. 子集 II

``` cpp
class Solution {
public:
    void dfs(vector<vector<int>>& res, vector<int>& state, vector<int>& nums, int idx) {
        // for (auto v : state) {
        //     cout << v << ",";
        // }
        // cout << endl;
        if (idx == nums.size()) {
            res.push_back(state);
            return;
        }        

        state.push_back(nums[idx]);
        dfs(res, state, nums, idx+1);
        state.pop_back();
        
        int next_idx = idx+1;
        while (next_idx < nums.size() 
            && nums[next_idx] == nums[next_idx-1]) {
            ++next_idx;
        }

        dfs(res, state, nums, next_idx);
    }
    vector<vector<int>> subsetsWithDup(vector<int>& nums) {
        vector<vector<int>> res;
        vector<int> state;
        sort(nums.begin(), nums.end());
        dfs(res, state, nums, 0);
        return res;
    }
};
```

对于 idx 的数值，选还是不选的问题，把递归树画出来后，比如`1,2,2`，发生重复的原因是当第一个2选了后并且第二个2没有选择，与第一个2没选但是选了第二个2发生了重复。


## 搜素旋转数组
``` cpp
class Solution {
public:
    int search(vector<int>& nums, int target) {
        int left = 0, right = nums.size() - 1;
        while (left <= right) {
            int mid = (left + right) / 2;
            if (nums[mid] == target) {
                return mid;
            }
            if (nums[left] <= nums[mid]) {
                if (nums[left] <= target && target < nums[mid]) {
                    right = mid - 1;
                } else {
                    left = mid + 1;
                }
            } else {
                if (nums[mid] < target && target <= nums[right]) {
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
            }
        }
        return -1;
    }
};
```

二分的问题见：<https://www.youtube.com/watch?v=U3U9XMtSxQc>

⚠️ 注意等号的处理

## 


## 题目链接

[39. 组合总和](https://leetcode-cn.com/problems/combination-sum/)

[40. 组合总和 II](https://leetcode-cn.com/problems/combination-sum-ii/)

[46. 全排列](https://leetcode-cn.com/problems/permutations/)

[47. 全排列 II](https://leetcode-cn.com/problems/permutations-ii/)

[77.组合](https://leetcode-cn.com/problems/combinations)

[78. 子集](https://leetcode-cn.com/problems/subsets/)

[90. 子集 II](https://leetcode-cn.com/problems/subsets-ii/)
