# OpenConduit — Agent Guide

This file gives AI coding agents the context needed to work effectively in this repository.

## What This Project Is
OpenConduit is a cross-platform Electron + React desktop app for chatting with AI providers (OpenAI, Anthropic, LM Studio) with support for MCP (Model Context Protocol) tool servers. It targets macOS, Windows, and Linux.

## Process Boundary — Critical
Electron has two isolated processes. **Never mix them up.**

| Process | Location | Can use |
|---------|----------|---------|
| Main | `src/main.ts`, `src/main/` | Node.js, Electron APIs, electron-store, providers, MCP |
| Renderer | `src/renderer/` | React, Zustand, DOM APIs, `window.api` |
| Preload | `src/preload.ts` | Bridge only — exposes `window.api` via `contextBridge` |

If a renderer component needs something from Node/Electron, add an IPC handler in `src/main/ipc.ts` and expose it in `preload.ts`.

## Adding a New AI Provider
1. Create `src/main/providers/myprovider.ts` — export a streaming function
2. Add an IPC handler in `src/main/ipc.ts` under the `ai:*` namespace
3. Expose via `preload.ts` if needed
4. Add provider type to `src/shared/types.ts`
5. Add a settings section in `src/renderer/components/SettingsPanel.tsx`

## Adding a New Setting
1. Add the field to `AppSettings` in `src/shared/types.ts`
2. Add a default in `src/main/store/settings.ts`
3. Update the renderer mirror in `src/renderer/stores/settingsStore.ts`
4. Add UI in the relevant `SettingsPanel.tsx` tab

## Adding an IPC Channel
Pattern: `namespace:action` (e.g. `ai:stream`, `settings:get`)
1. Add handler in `src/main/ipc.ts` inside `registerIpcHandlers`
2. Add the invoke call in `src/preload.ts` under `contextBridge.exposeInMainWorld`
3. Add the type signature to `src/renderer/env.d.ts` or `window.api` types

## Key Files
| File | Purpose |
|------|---------|
| `src/shared/types.ts` | All shared TypeScript types — start here |
| `src/main/ipc.ts` | All IPC handlers — one file for discoverability |
| `src/preload.ts` | `window.api` surface — only safe renderer↔main bridge |
| `src/renderer/stores/conversationStore.ts` | Core chat state |
| `src/renderer/stores/settingsStore.ts` | Renderer-side settings (mirrors main-process store) |

## Styling Rules
- Tailwind CSS v4: use `@import "tailwindcss"` (NOT `@tailwind base/components/utilities`)
- Brand colors: `brand-blue`, `brand-violet`, `brand-cyan`, `brand-navy`, `brand-surface`, `brand-muted`, `brand-white`
- CSS variables: `var(--color-primary)`, `var(--color-surface)`, etc. (from `src/styles/brand_tokens.css`)
- Dark mode via `class` strategy — assume dark background

## Icons & Assets
- `icons/` — platform icons for packaging (`icon.icns`, `favicon.ico`, `icon-512x512.png`)
- `public/app-icon.png` — brand icon served to renderer (available at `/app-icon.png`)
- Icon PNGs have transparent rounded corners; do not replace with square/opaque images

## State Persistence Keys
| Store | Key |
|-------|-----|
| Conversations | `openconduit-conversations` (Zustand persist) |
| Analytics | `openconduit-analytics` (Zustand persist) |
| Settings | `openconduit-settings` (electron-store) |

## Hardcoded Constants (main process)
```typescript
// src/main/ipc.ts
const GITHUB_REPO = 'OpenConduit/Client';
const WORKER_URL  = 'https://openconduit.chumchal-account.workers.dev';
```

## Build & Run
```bash
npm start                              # Dev (electron-forge start)
npm run lint                           # ESLint
npm run make                           # All platforms
npm run make -- --platform darwin      # macOS
npm run make -- --platform win32       # Windows
cd worker && wrangler deploy           # Deploy Cloudflare Worker
```

## Do Not
- Import `electron`, `fs`, `path`, `child_process` in renderer files
- Use `@tailwind` directives (Tailwind v3 syntax)
- Store API keys in Zustand or localStorage — use IPC → electron-store
- Commit `.env`, `wrangler.toml` secrets, or `brand/` folder (gitignored)
