---
title: "实效性软件构建的途径-下"
date: 2020-04-15T19:32:10+08:00
draft: false
categories:
  - notes
---

## 前言

如果一次性总结，文章太过于冗长，上部分更加是一种在编程中会碰到的技术细节，而这一部分是一些编程中需要记住的良好习惯。

## 1. 养成估算的习惯

1000字节数据通过路由器需要多少时间？类似这样的问题需要有个大致的答案，通过学习估算，能将估算发展到对事物的数量级有直觉的程度，就可以确定方案的可能性。

无论什么时候有人需要你进行估算，你都可以给出答案。
如果没有经验，估算通常可以去问问已经做过该事情的人。
追踪自己的估算能力，如果估算错了，找出什么事情与自己的预期不同。

## 2. 调试的过程

这里不讲技术上怎么调试，而是另外一种途径进行调试：向别人一行一行解释代码的作用，并且详细描述假定的情况，可能在解释的过程中就可以知道哪里处理问题。

花很长时间找到bug后，想想可以做点什么使找到这个bug更加容易，例如内建更加好的测试。

## 3. 重构

不要害怕重构，老旧的代码如果不适用，所有代码都可以被替换。重构往往在非正交设计，违反DRY原则、过时的知识、性能缺陷存在时发生。

那么如何合理地进行重构？

1. 不要在重构同时新增功能
2. 开始重构前要有良好的测试，确保重构后能通过
3. 采用小改动的模式，利用局部改动慢慢扩大到更大规模的改动，避免长时间的调试

## 4. 测试的一些建议

根据合约(契约式编程)进行单元测试，先测试子模块，再测试模块自身子模块，再测试模块自身。
单元测试应该在模块目录，使测试代码容易找到，既可以说明怎么使用模块的功能，又可以用于构建回归测试，验证未来对代码的改动是否正确。

另外测试都应该具有以下功能：

1. setup和cleanup的标准途径
2. 可选择地选择可用测试方法
3. 分析输出结果的手段
4. 标准化故障报告的形式

## 5. 曳光弹与原型开发

曳光弹原本是指在机枪子弹中间接出现的用于显示子弹射击目标的子弹，比起精确计算风向、射速、角度再射击，曳光弹的方式更加实际。曳光弹的原理就是指，尝试制作一个项目，慢慢地靠近客户需求的一种构建方式，可以有效的展现工作进度，并且这种构建方式的每一段代码都需要有完整的错误检查，结构，文档，以及自查。

而原型开发这种方式通常是一种实验性的探索，为取得某种功能，不必关注太多细节情况，通常没有太多文档和注释。

## 6. 做变化的催化剂

这一点对自己的要求比较高，在团队合作中，写出很好的代码，让团队的其他人大吃一惊，渐渐影响他们，从而提高项目质量。

## 7. 不要过度修饰和求精程序

这和过早优化的概念同理，但概念更加偏向于用户，今日了不起的软件往往被明天更加完美的软件更加可取，让用户先使用，用他们的反馈引领软件走向最终解决方案。但是并不是说就可以用不整洁的代码，或者制作糟糕的代码。

## 8. 管理知识资产

对于金融资产的管理：

- 定期投资，形成习惯
- 多元化是长期成功的关键
- 在保守的投资和高风险，高回报的投资之间平衡资产
- 设法低买高卖获取最大回报
- 周期性的评估和平衡财产

而程序员管理自己的知识资产可以类比：

- 定投，周期性的学习
- 多元化，广度学习，底线是需要知道目前所使用技术的各种特性，优劣
- 管理风险，不要把所学的技术都放在一个篮子里
- 低买高卖：新兴技术可能就是被低估的股票，提前学习可能可以更好的找到工作
- 重新评估：热门技术可能很快就冷门了，甚至过一段时间有需要重新温习忘记的数据库技术等，需要对自己的知识体系重新评估。

所以可以给自己设立一些周期性的目标，防止自己的脱节：

- 定期投资可以是每年至少学习一种新的语言，每月阅读一本技术书籍，阅读非技术书籍。
- 偶尔学习一些公开课
- 参与一些组织，打听公司以外的人都在做什么
- 试验不同的环境，技术或者非技术都是如此，逃离舒适区
- 持续投入！

## 9. 交流

交流很重要，即使是“自闭”人群，该说话的时候还是得好好说话。

书中提到的最关键的几点：

### 了解听众

1) 你想让他们学到什么
2) 他们对你讲的什么感兴趣
3) 他们有多丰富的经验
4) 他们要多少细节
5) 你想要谁拥有这些信息
6) 你如何促使他们听你说话

### 认真倾听和及时回复

对于前者，你不听别人讲话，别人也懒得听你的 ：）；及时回复这一点，在现代社会中其实很容易遗忘，但是即使简单回复，”我稍后回复你“，也会显得礼貌。

## 参考资料

- 《The Programatic Programmer》
- <https://en.wikipedia.org/wiki/Law_of_Demeter>
