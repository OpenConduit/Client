# Changelog

All notable changes to OpenConduit will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1](https://github.com/OpenConduit/Client/compare/v1.2.0...v1.2.1) (2026-05-18)


### Bug Fixes

* update @openconduit/core to ^1.2.0 ([b15604b](https://github.com/OpenConduit/Client/commit/b15604b9b9982341d4d8e101f27732b5ea888d61))
* update @openconduit/core to ^1.2.0 ([0723ea2](https://github.com/OpenConduit/Client/commit/0723ea2e64b8419132ba2acda45999e010aa1d0d))

## [1.2.0-alpha.1](https://github.com/OpenConduit/Client/compare/v1.1.0-alpha.1...v1.2.0-alpha.1) (2026-05-18)


### Features

* Add native Ollama provider with localhost detection and dynamic model discovery ([3936377](https://github.com/OpenConduit/Client/commit/393637715f42a78ebe0b7f57c71f2615399fa76d))
* artifacts rendering + saved files panel ([9091e96](https://github.com/OpenConduit/Client/commit/9091e96b8690407f821a8c7edfa26e9c44b218ab))
* artifacts rendering + saved files panel ([#9](https://github.com/OpenConduit/Client/issues/9)) ([a327a95](https://github.com/OpenConduit/Client/commit/a327a950e0fdab67a67dab52039a47fb5e7f523c))
* **core:** add setConversations, personaId/workspaceId to Conversation type ([4523286](https://github.com/OpenConduit/Client/commit/4523286bcc40d7f0eebc844420a7658f82630964))
* **core:** multi-model comparison mode with multi-turn history ([#11](https://github.com/OpenConduit/Client/issues/11)) ([a9c3549](https://github.com/OpenConduit/Client/commit/a9c354957f86f0bd07d85ef4f15e238c0a4bda33))
* **core:** multi-model comparison mode with multi-turn history ([#11](https://github.com/OpenConduit/Client/issues/11)) ([504901f](https://github.com/OpenConduit/Client/commit/504901f4b235d8fc4506606a99ac6a44e23d1a73))
* **core:** SettingsPanel accepts extraTabs and hideTabs props ([f01c14f](https://github.com/OpenConduit/Client/commit/f01c14f37a11afa0f533ab603127df3bbfbb64ff))
* **desktop:** add Google Gemini provider ([#6](https://github.com/OpenConduit/Client/issues/6)) ([e217170](https://github.com/OpenConduit/Client/commit/e217170e7b12bfe55f961dfc34fca1a9fba493bd))
* **desktop:** add Google Gemini provider ([#6](https://github.com/OpenConduit/Client/issues/6)) ([c8d8a69](https://github.com/OpenConduit/Client/commit/c8d8a69e169e9a6c6460ac5a16a66e8947e4636a))
* file & image attachment support ([#5](https://github.com/OpenConduit/Client/issues/5)) ([f84bae9](https://github.com/OpenConduit/Client/commit/f84bae9c087235046528937e9eb28c9be7474fb0))
* file & image attachment support ([#5](https://github.com/OpenConduit/Client/issues/5)) ([e61c37f](https://github.com/OpenConduit/Client/commit/e61c37f13b87d0a8e26baaf1f8e3c4c18759af3a))
* intelligent model routing with profiles, compare picker, and streaming fixes ([2de44f5](https://github.com/OpenConduit/Client/commit/2de44f5875d1da7790460d55128c64b158142c02))
* intelligent model routing with profiles, compare picker, and streaming fixes ([46184a0](https://github.com/OpenConduit/Client/commit/46184a03557f5faeb26f3b5447d4aad34f04beb6))
* MCP server + provider marketplace ([#10](https://github.com/OpenConduit/Client/issues/10), [#31](https://github.com/OpenConduit/Client/issues/31)) ([01315b7](https://github.com/OpenConduit/Client/commit/01315b72fb425097104fc4a1ed524aa732777b70))
* MCP server + provider marketplace with per-conversation tool toggles ([941d99a](https://github.com/OpenConduit/Client/commit/941d99aab0b7adf30a11c6fef16d6083318828cb))


### Bug Fixes

* add vite/client types to tsconfig for import.meta.glob support ([207d0d8](https://github.com/OpenConduit/Client/commit/207d0d89ab95a4992f251733ea3ead4af946f97f))
* beta channel shows only beta builds, alpha channel shows alpha+beta ([a0697cf](https://github.com/OpenConduit/Client/commit/a0697cfd2f5925a491a96129e670f6faa9f4b334))
* class-based dark mode for Tailwind v4 and system theme listener ([c257503](https://github.com/OpenConduit/Client/commit/c25750397e84fdf1b14230a07d325d6b770c501b)), closes [#19](https://github.com/OpenConduit/Client/issues/19)
* resolve @openconduit/core as npm package in Vite ([665a0d5](https://github.com/OpenConduit/Client/commit/665a0d550c2ce997eba6b634bcaa10658a37e865))
* resolve @openconduit/core as npm package in Vite ([951cd93](https://github.com/OpenConduit/Client/commit/951cd934bb7bb1d75dc3e64ebb11a6acead1a209))
* theme switching ([#19](https://github.com/OpenConduit/Client/issues/19)) ([a5930d6](https://github.com/OpenConduit/Client/commit/a5930d693cac0166dc62e0b76ac4fe8817d06f02))

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
