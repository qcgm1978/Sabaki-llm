# ![Sabaki AI: Intelligent Go Assistant with LLM and KataGo Integration](./banner-llm.png)

[![Download the latest release](https://img.shields.io/github/downloads/SabakiHQ/Sabaki/latest/total?label=download)](https://github.com/SabakiHQ/Sabaki/releases)
[![CI](https://github.com/SabakiHQ/Sabaki/workflows/CI/badge.svg?branch=master&event=push)](https://github.com/SabakiHQ/Sabaki/actions)
[![Donate](https://img.shields.io/badge/donate-paypal-blue.svg)](https://www.paypal.me/yishn/5)

## Core AI Agent Features

This project is built on the Sabaki Go interface, with a focus on integrating
advanced AI features to create an intelligent Go assistant:

### MCP (Model Context Protocol) Integration

- Serves as a standardized communication bridge between LLMs and professional
  tools
- Enables seamless collaboration between large language models and the KataGo Go
  engine
- Provides a secure, efficient framework for cross-system information sharing

### LLM (Large Language Model) Capabilities

- Interact with Go AI through natural language
- Get detailed explanations of Go positions and moves
- Ask questions about strategy, tactics, and Go principles
- Request specific board region analysis using natural language
- Persistent conversation history with up/down arrow key navigation for quick
  access to previous questions

### KataGo Professional Analysis

- Combines LLM's natural language understanding with KataGo's professional Go
  analysis capabilities
- Provides precise move recommendations and win rate analysis
- Executes corresponding analysis through MCP protocol based on LLM-processed
  user requests

### Intelligent Agent Architecture

- LLMs act as the "brain" responsible for understanding questions and generating
  natural language answers
- KataGo serves as a "professional skill extension" providing precise domain
  analysis
- MCP as a communication protocol enables efficient collaboration between the
  two
- Delivers both professional and easily understandable Go analysis experience
  for users

![Screenshot](screenshot-llm.png)

## MCP

Model Context Protocol (MCP) is a communication protocol proposed and
open-sourced by Anthropic at the end of 2024. Its main purpose is to solve the
need for seamless integration between Large Language Models (LLMs) and external
data sources and tools, and is compared to the "HTTP protocol for large models".

About the relationship between MCP and KataGo:

1. Core functionality of MCP: MCP aims to provide AI models with a unified way
   to connect various external data services and tools, replacing fragmented
   integration solutions with standardized protocols.
2. LLM interaction with professional tools: Theoretically, MCP can indeed serve
   as a bridge between LLMs and professional domain tools (such as the KataGo Go
   engine). Through MCP, LLMs can pass Go-related questions to KataGo for
   processing, and then receive KataGo's professional analysis results.
3. Agent architecture advantages: This integration perfectly aligns with the
   concept of agent architecture - LLMs serve as the "brain" responsible for
   understanding problems and generating answers, while professional tools (such
   as KataGo) serve as "professional skill extensions" providing precise
   analysis within the domain.
4. Practical application value: Implementing LLM and KataGo interaction through
   MCP can combine the advantages of both - utilizing KataGo's professional Go
   analysis capabilities and LLM's natural language understanding and
   explanation capabilities to provide users with both professional and easily
   understandable Go analysis results. In summary, MCP can indeed serve as a
   technical foundation for implementing LLM and KataGo interaction, providing a
   standardized framework for secure, efficient information sharing between
   different systems, enabling general AI to collaborate with professional
   domain tools to provide more comprehensive services.

## Project Description

This project is an intelligent Go assistant developed based on the Sabaki Go
interface, focusing on integrating advanced AI technology with Go analysis.
Through the MCP protocol, we have achieved seamless collaboration between LLMs
and KataGo, providing users with a more intelligent and intuitive Go analysis
experience.

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

---

[中文版本 (Chinese Version)](README.md)
