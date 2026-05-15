# Changelog

All notable changes to OpenConduit will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-05-15

### Added
- Multi-provider AI chat: OpenAI, Anthropic (Claude), and LM Studio (OpenAI-compatible)
- Streaming responses with real-time token output
- Persistent conversation history with sidebar navigation
- Per-conversation system prompt editor
- MCP (Model Context Protocol) tool server support — HTTP-SSE and stdio transports
- Tool call approval UI — allow or deny individual tool invocations
- AI Task Tracking (Labs) — AI maintains a live task list during multi-step work
- AI Clarifying Questions (Labs) — AI asks targeted questions inline before proceeding
- Parameter controls — temperature, max tokens, top-p per conversation
- Context window usage indicator with overflow warning
- Conversation export as JSON or Markdown
- Analytics tab — token usage and cost tracking across conversations
- Update checker — polls Cloudflare Worker for latest GitHub release
- In-app feedback — submit bug reports and feature requests as GitHub Issues
- Dark mode support (system, light, dark)
- macOS native window with hidden-inset title bar and traffic-light spacing
- Cross-platform packaging for macOS (arm64 + x64), Windows, and Linux via electron-forge

[1.0.0]: https://github.com/OpenConduit/Client/releases/tag/v1.0.0
