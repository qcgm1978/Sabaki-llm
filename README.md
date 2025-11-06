# ![Sabaki AI: 集成LLM和KataGo的智能围棋助手](./banner-llm.png)

[![下载最新版本](https://img.shields.io/github/downloads/SabakiHQ/Sabaki/latest/total?label=下载)](https://github.com/SabakiHQ/Sabaki/releases)
[![CI](https://github.com/SabakiHQ/Sabaki/workflows/CI/badge.svg?branch=master&event=push)](https://github.com/SabakiHQ/Sabaki/actions)

## AI Agent 核心功能

本项目基于 Sabaki 围棋界面开发，重点集成了先进的 AI 功能，打造智能围棋助手：

### MCP（模型上下文协议）集成

- 作为 LLM 与专业工具之间的标准化通信桥梁
- 实现大型语言模型与 KataGo 围棋引擎的无缝协作
- 提供安全、高效的跨系统信息共享框架

### LLM（大型语言模型）功能

- 通过自然语言与围棋 AI 交互
- 获取围棋位置和着法的详细解释
- 询问有关战略、战术和围棋原则的问题
- 使用自然语言请求特定区域的棋盘分析
- 对话历史记录持久化，支持上下键快速切换历史问题

### KataGo 专业分析

- 结合 LLM 的自然语言理解和 KataGo 的专业围棋分析能力
- 提供精准的落子建议和胜率分析
- 通过 MCP 协议接收 LLM 处理后的用户请求并执行相应分析

### 智能 Agent 架构

- LLM 作为"大脑"负责理解问题和生成自然语言回答
- KataGo 作为"专业技能扩展"提供领域内的精准分析
- MCP 作为通信协议实现两者的高效协作
- 为用户提供既专业又易于理解的围棋分析体验

![截图](screenshot-llm.png)

## 项目说明

本项目是基于 Sabaki 围棋界面开发的智能围棋助手，专注于将先进的 AI 技术与围棋分析
相结合。通过 MCP 协议，我们实现了 LLM 与 KataGo 的无缝协作，为用户提供更智能、更
直观的围棋分析体验。

## 许可证

本项目基于 Sabaki（MIT 许可证）开发。

---

[英文版本 (English Version)](README_EN.md)
