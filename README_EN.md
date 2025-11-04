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
- LLM (Large Language Model) integration with MCP

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

---

[中文版本 (Chinese Version)](README.md)
