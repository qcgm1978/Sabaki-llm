# ![Sabaki: 一个优雅的围棋/象棋/围棋棋盘和SGF编辑器，为更文明的时代而设计。](./banner-llm.png)

[![下载最新版本](https://img.shields.io/github/downloads/SabakiHQ/Sabaki/latest/total?label=下载)](https://github.com/SabakiHQ/Sabaki/releases)
[![CI](https://github.com/SabakiHQ/Sabaki/workflows/CI/badge.svg?branch=master&event=push)](https://github.com/SabakiHQ/Sabaki/actions)
[![捐赠](https://img.shields.io/badge/donate-paypal-blue.svg)](https://www.paypal.me/yishn/5)

## 功能特性

- 模糊落子放置
- 读取和保存 SGF 棋局和对局集，打开 wBaduk NGF 和 Tygem GIB 文件
- 使用
  [Markdown 子集](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/markdown.md)
  显示格式化的 SGF 评注，并标注棋盘位置和着法
- 使用
  [纹理和主题](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/theme-directory.md)
  个性化棋盘外观
- SGF 编辑工具，包括线条和箭头棋盘标记
- 复制和粘贴变化图
- 强大的撤销/重做功能
- 快速的对局树
- 得分估计器和计分工具
- 通过位置和评注文本查找着法
- [GTP 引擎](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/engines.md)
  支持，以及对
  [支持引擎的棋盘分析](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/engine-analysis-integration.md)
- MCP（模型上下文协议）集成，实现 LLM 和 KataGo 之间的无缝协作
  - 使用自然语言请求棋盘分析
  - 获取围棋位置和着法的详细解释
  - 询问有关战略、战术和围棋原则的问题
- 猜测模式
- 自动播放对局
- 与 MCP 集成的 LLM（大型语言模型）

![截图](screenshot-llm.png)

## MCP

模型上下文协议（Model Context Protocol，简称 MCP）是由 Anthropic 于 2024 年底提
出并开源的一种通信协议。它的主要目的是解决大型语言模型(LLM)与外部数据源及工具之
间无缝集成的需求，被比作"大模型的 HTTP 协议"。

关于 MCP 与 KataGo 的关系：

1. MCP 的核心功能：MCP 旨在为 AI 模型提供统一的方式来连接各种外部数据服务和工具
   ，通过标准化协议替代碎片化的集成方案。
2. LLM 与专业工具交互：从理论上讲，MCP 确实可以作为 LLM 与专业领域工具（如
   KataGo 围棋引擎）之间的桥梁。通过 MCP，LLM 可以将围棋相关问题传递给 KataGo 处
   理，然后接收 KataGo 的专业分析结果。
3. 智能体架构优势：这种集成正好符合智能体/Agent 架构的理念 - LLM 作为"大脑"负责
   理解问题和生成回答，专业工具（如 KataGo）作为"专业技能扩展"提供领域内的精准分
   析。
4. 实际应用价值：通过 MCP 实现 LLM 与 KataGo 的交互，可以结合二者优势 - 利用
   KataGo 的专业围棋分析能力和 LLM 的自然语言理解与解释能力，为用户提供既专业又
   易于理解的围棋分析结果。总结来说，MCP 确实可以作为实现 LLM 与 KataGo 交互的技
   术基础，它为不同系统之间的安全、高效信息共享提供了标准化框架，使通用 AI 能够
   与专业领域工具协作，提供更全面的服务。

## 文档

更多信息请访问
[文档](https://github.com/SabakiHQ/Sabaki/blob/master/docs/README.md)。欢迎
[贡献](https://github.com/SabakiHQ/Sabaki/blob/master/CONTRIBUTING.md)到这个项目
。

## 构建和测试

请参阅文档中的
[构建和测试](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/building-tests.md)
部分。

## 许可证

本项目采用
[MIT 许可证](https://github.com/SabakiHQ/Sabaki/blob/master/LICENSE.md)。

## 捐赠者

非常感谢这些可爱的人们：

- Eric Wainwright
- Michael Noll
- John Hager
- Azim Palmer
- Nicolas Puyaubreau
- Hans Christian Poerschke
- David Göbel
- Dominik Olszewski
- Brian Weaver
- Philippe Fanaro
- James Tudor
- Frank Orben
- Dekun Song
- Dimitri Rusin
- Andrew Thieman
- Adrian Petrescu
- Karlheinz Agsteiner
- Petr Růžička
- Sergio Villegas
- Jake Pivnik

## 相关项目

- [Shudan](https://github.com/SabakiHQ/Shudan) - 高度可定制的低级 Preact 围棋盘
  组件。
- [boardmatcher](https://github.com/SabakiHQ/boardmatcher) - 查找围棋盘布局中的
  模式和形状并命名着法。
- [deadstones](https://github.com/SabakiHQ/deadstones) - 确定死子的简单蒙特卡洛
  函数。
- [go-board](https://github.com/SabakiHQ/go-board) - 围棋盘数据类型。
- [gtp](https://github.com/SabakiHQ/gtp) - 处理 GTP 引擎的 Node.js 模块。
- [immutable-gametree](https://github.com/SabakiHQ/immutable-gametree) - 不可变
  的对局树数据类型。
- [influence](https://github.com/SabakiHQ/influence) - 估算围棋位置影响力地图的
  简单启发式方法。
- [sgf](https://github.com/SabakiHQ/sgf) - 用于解析和创建 SGF 文件的库。

---

[英文版本 (English Version)](README_EN.md)
