# ![Sabaki: An elegant Go/Baduk/Weiqi board and SGF editor for a more civilized age.](./banner-llm.png)

[![Download the latest release](https://img.shields.io/github/downloads/SabakiHQ/Sabaki/latest/total?label=download)](https://github.com/SabakiHQ/Sabaki/releases)
[![CI](https://github.com/SabakiHQ/Sabaki/workflows/CI/badge.svg?branch=master&event=push)](https://github.com/SabakiHQ/Sabaki/actions)
[![Donate](https://img.shields.io/badge/donate-paypal-blue.svg)](https://www.paypal.me/yishn/5)

## Features

- Fuzzy stone placement
- Read and save SGF games and collections, open wBaduk NGF and Tygem GIB files
- Display formatted SGF comments using a
  [subset of Markdown](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/markdown.md)
  and annotate board positions & moves
- Personalize board appearance with
  [textures & themes](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/theme-directory.md)
- SGF editing tools, including lines & arrows board markup
- Copy & paste variations
- Powerful undo/redo
- Fast game tree
- Score estimator & scoring tool
- Find move by move position and comment text
- [GTP engines](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/engines.md)
  support with
  [board analysis for supported engines](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/engine-analysis-integration.md)
- MCP (Model Context Protocol) integration for seamless collaboration between
  LLMs and KataGo
  - Use natural language to request board analysis
  - Get detailed explanations of Go positions and moves
  - Ask questions about strategy, tactics, and game principles
- Guess mode
- Autoplay games

![Screenshot](screenshot.png)

## MCP

模型上下文协议（Model Context Protocol，简称 MCP）是由 Anthropic 于 2024 年底提
出并开源的一种通信协议。它的主要目的是解决大型语言模型(LLM)与外部数据源及工具之
间无缝集成的需求，被比作"大模型的 HTTP 协议"。

关于 MCP 与 KataGo 的关系：

1. MCP 的核心功能 ：MCP 旨在为 AI 模型提供统一的方式来连接各种外部数据服务和工具
   ，通过标准化协议替代碎片化的集成方案 3 。
2. LLM 与专业工具交互 ：从理论上讲，MCP 确实可以作为 LLM 与专业领域工具（如
   KataGo 围棋引擎）之间的桥梁。通过 MCP，LLM 可以将围棋相关问题传递给 KataGo 处
   理，然后接收 KataGo 的专业分析结果 4 。
3. 智能体架构优势 ：这种集成正好符合智能体/Agent 架构的理念 - LLM 作为"大脑"负责
   理解问题和生成回答，专业工具（如 KataGo）作为"专业技能扩展"提供领域内的精准分
   析 1 。
4. 实际应用价值 ：通过 MCP 实现 LLM 与 KataGo 的交互，可以结合二者优势 - 利用
   KataGo 的专业围棋分析能力和 LLM 的自然语言理解与解释能力，为用户提供既专业又
   易于理解的围棋分析结果 5 。总结来说，MCP 确实可以作为实现 LLM 与 KataGo 交互
   的技术基础，它为不同系统之间的安全、高效信息共享提供了标准化框架，使通用 AI
   能够与专业领域工具协作，提供更全面的服务。

## Documentation

For more information visit the
[documentation](https://github.com/SabakiHQ/Sabaki/blob/master/docs/README.md).
You're welcome to
[contribute](https://github.com/SabakiHQ/Sabaki/blob/master/CONTRIBUTING.md) to
this project.

## Building & Tests

See
[Building & Tests](https://github.com/SabakiHQ/Sabaki/blob/master/docs/guides/building-tests.md)
in the documentation.

## License

This project is licensed under the
[MIT license](https://github.com/SabakiHQ/Sabaki/blob/master/LICENSE.md).

## Donators

A big thank you to these lovely people:

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

## Related

- [Shudan](https://github.com/SabakiHQ/Shudan) - A highly customizable,
  low-level Preact Goban component.
- [boardmatcher](https://github.com/SabakiHQ/boardmatcher) - Finds patterns &
  shapes in Go board arrangements and names moves.
- [deadstones](https://github.com/SabakiHQ/deadstones) - Simple Monte Carlo
  functions to determine dead stones.
- [go-board](https://github.com/SabakiHQ/go-board) - A Go board data type.
- [gtp](https://github.com/SabakiHQ/gtp) - A Node.js module for handling GTP
  engines.
- [immutable-gametree](https://github.com/SabakiHQ/immutable-gametree) - An
  immutable game tree data type.
- [influence](https://github.com/SabakiHQ/influence) - Simple heuristics for
  estimating influence maps on Go positions.
- [sgf](https://github.com/SabakiHQ/sgf) - A library for parsing and creating
  SGF files.
