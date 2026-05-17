# OpenConduit — Agent Guide

This file gives AI coding agents the context needed to work effectively in this repository.

## What This Project Is
OpenConduit is a cross-platform Electron + React desktop app for chatting with AI providers (OpenAI, Anthropic, LM Studio, Google Gemini) with support for MCP (Model Context Protocol) tool servers and intelligent model routing. It targets macOS, Windows, and Linux.

## Monorepo Structure
```
packages/
  core/                        # Shared renderer code (React, hooks, stores, types)
    src/
      components/              # React UI components
      hooks/                   # useChat, useCompare, etc.
      stores/                  # Zustand stores (conversation, settings, ui, analytics, tasks)
      services/                # IPC service wrappers (chat, mcp, settings, routing)
      data/                    # Static registries (providerRegistry.ts, provider-registry.json)
      types.ts                 # All shared TypeScript types — start here
  desktop/                     # Electron shell
    src/
      main.ts                  # Electron entry point
      preload.ts               # contextBridge — exposes window.api
      main/
        ipc.ts                 # All IPC handlers
        providers/             # AI provider streaming clients
        routing.ts             # Intelligent model routing classifier
        mcp/client.ts          # MCP client (HTTP-SSE + stdio)
        store/settings.ts      # electron-store, key: "openconduit-settings"
```

## Process Boundary — Critical
Electron has two isolated processes. **Never mix them up.**

| Process | Location | Can use |
|---------|----------|---------|
| Main | `packages/desktop/src/main.ts`, `packages/desktop/src/main/` | Node.js, Electron APIs, electron-store, providers, MCP |
| Renderer | `packages/core/src/` | React, Zustand, DOM APIs, `window.api` |
| Preload | `packages/desktop/src/preload.ts` | Bridge only — exposes `window.api` via `contextBridge` |

If a renderer component needs something from Node/Electron, add an IPC handler in `packages/desktop/src/main/ipc.ts` and expose it in `preload.ts`.

## Adding a New AI Provider

Use **`packages/desktop/src/main/providers/gemini.ts`** as the canonical reference implementation.

1. Create `packages/desktop/src/main/providers/myprovider.ts` — export a `stream*` function that yields `StreamEvent` deltas
2. Add the provider type to `ProviderType` in `packages/core/src/types.ts`
3. Wire into the IPC handler switch in `packages/desktop/src/main/ipc.ts`
4. Add a settings section for the new provider in `packages/core/src/components/SettingsPanel.tsx` (follow the existing OpenAI/Anthropic/Gemini pattern)
5. Add an entry to the provider marketplace registry (see below)

### Provider Marketplace Registry
The marketplace is powered by `packages/core/src/data/provider-registry.json`. Each entry follows this shape:

```jsonc
{
  "id": "my-provider",              // unique kebab-case ID
  "name": "My Provider",
  "description": "One-line description shown in the marketplace",
  "category": "cloud-proprietary",  // cloud-proprietary | cloud-opensource | meta | local | enterprise | custom
  "icon": "🤖",                      // emoji or URL
  "type": "openai",                  // ProviderType: openai | anthropic | lmstudio | gemini
  "baseUrl": "https://api.myprovider.com/v1",  // optional — pre-fills the Base URL field
  "defaultModel": "my-model-name",   // optional — pre-fills Default Model
  "requiresApiKey": true,
  "apiKeyUrl": "https://myprovider.com/api-keys",  // optional — linked in the UI
  "badge": "API Key",               // Free tier | API Key | Local | Enterprise | Free
  "notes": "Optional caveat shown in the marketplace card",
  "modelCount": "50+"               // optional display string
}
```

The registry is typed in `packages/core/src/data/providerRegistry.ts` — add new entries to `provider-registry.json` only.

## Adding a New Setting
1. Add the field to `AppSettings` in `packages/core/src/types.ts`
2. Add a default in `packages/desktop/src/main/store/settings.ts`
3. Update the renderer mirror in `packages/core/src/stores/settingsStore.ts`
4. Add UI in the relevant `SettingsPanel.tsx` tab

## Adding an IPC Channel
Pattern: `namespace:action` (e.g. `ai:stream`, `settings:get`)
1. Add handler in `packages/desktop/src/main/ipc.ts` inside `registerIpcHandlers`
2. Expose via `contextBridge` in `packages/desktop/src/preload.ts`
3. Add a service wrapper in `packages/core/src/services/`

## Key Files
| File | Purpose |
|------|---------|
| `packages/core/src/types.ts` | All shared TypeScript types — start here |
| `packages/desktop/src/main/ipc.ts` | All IPC handlers — one file for discoverability |
| `packages/desktop/src/preload.ts` | `window.api` surface — only safe renderer↔main bridge |
| `packages/desktop/src/main/providers/gemini.ts` | Canonical newest provider — use as reference |
| `packages/core/src/data/provider-registry.json` | Marketplace provider entries |
| `packages/core/src/stores/conversationStore.ts` | Core chat state |
| `packages/core/src/stores/settingsStore.ts` | Renderer-side settings mirror |

## Styling Rules
- Tailwind CSS v4: use `@import "tailwindcss"` (NOT `@tailwind base/components/utilities`)
- Brand colors: `brand-blue`, `brand-violet`, `brand-cyan`, `brand-navy`, `brand-surface`, `brand-muted`, `brand-white`
- CSS variables: `var(--color-primary)`, `var(--color-surface)`, etc. (from `packages/core/src/styles/brand_tokens.css`)
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
- Import `electron`, `fs`, `path`, `child_process` in renderer (`packages/core/`) files
- Use `@tailwind` directives (Tailwind v3 syntax)
- Store API keys in Zustand or localStorage — use IPC → electron-store
- Commit `.env`, `wrangler.toml` secrets, or `brand/` folder (gitignored)
- Add `icon_512x512@2x.png` to iconsets — `iconutil` treats it as a duplicate
