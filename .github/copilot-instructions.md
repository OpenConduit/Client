# OpenConduit — Copilot Instructions

## Project Overview
OpenConduit is a cross-platform desktop AI chat application built with Electron + React. It supports multiple AI providers (OpenAI, Anthropic, LM Studio, Google Gemini), MCP (Model Context Protocol) tool servers, intelligent model routing, and is packaged with electron-forge for macOS, Windows, and Linux.

## Tech Stack
- **Runtime**: Electron 42 (contextIsolation: true, sandbox: false)
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **State**: Zustand v5 with `persist` middleware
- **Settings (main process)**: `electron-store` v11
- **Build/package**: electron-forge (MakerSquirrel, MakerZIP, MakerDeb, MakerRpm)
- **Worker**: Cloudflare Worker at `https://openconduit.chumchal-account.workers.dev`

## Repository Structure
```
packages/
  core/                      # Shared renderer code (React, hooks, stores, types)
    src/
      components/            # React UI components (ChatArea, Sidebar, SettingsPanel, etc.)
      hooks/                 # useChat, useCompare, useBeforeSend, etc.
      stores/                # Zustand stores: conversation, settings, ui, analytics, tasks
      services/              # IPC service wrappers (chat, mcp, settings, routing)
      data/                  # Provider marketplace registry (providerRegistry.ts, provider-registry.json)
      styles/                # brand_tokens.css, brand_tokens.json
      types.ts               # Shared TypeScript types (AppSettings, Message, etc.)
  desktop/                   # Electron shell
    src/
      main.ts                # Electron entry: sets userData path, creates BrowserWindow
      preload.ts             # Context bridge — exposes window.api to renderer
      main/
        ipc.ts               # All IPC handlers (ai, mcp, settings, updater, feedback)
        providers/           # AI provider clients: openai.ts, anthropic.ts, lmstudio.ts, gemini.ts
        routing.ts           # Intelligent model routing classifier
        mcp/
          client.ts          # MCP client (HTTP-SSE + stdio transports)
        store/
          settings.ts        # electron-store, key: "openconduit-settings"
icons/                       # App icons: icon.icns, favicon.ico, icon-*.png (rounded corners, transparent bg)
public/
  app-icon.png               # Brand icon served to renderer (About tab)
docs/brand/                  # Brand reference images (guidelines, palette, typography)
worker/                      # Cloudflare Worker source (update checks + feedback → GitHub Issues)
```

## Key Conventions

### Electron / IPC
- All Node.js / Electron APIs live in **main process** (`packages/desktop/src/main/`). Never import them in renderer (`packages/core/`).
- The context bridge in `packages/desktop/src/preload.ts` exposes `window.api` to the renderer.
- IPC channels follow the pattern `ai:*`, `mcp:*`, `settings:*`, `updater:*`.
- `app.setPath('userData', path.join(app.getPath('appData'), 'openconduit'))` is called before `createWindow` so the path never changes on rename.

### Tailwind CSS v4
- Use `@import "tailwindcss"` in CSS files — **not** `@tailwind base/components/utilities`.
- Brand colors are available as Tailwind classes: `brand-blue`, `brand-violet`, `brand-cyan`, `brand-navy`, `brand-surface`, `brand-muted`, `brand-white`.
- CSS variables from `packages/core/src/styles/brand_tokens.css` are also globally available: `var(--color-primary)`, `var(--color-surface)`, etc.
- Dark mode uses `class` strategy.

### State Management
- Zustand stores in renderer only. Main process state lives in `electron-store`.
- Do not persist sensitive data (API keys) in Zustand — those go through IPC to `settings.ts`.

### macOS specifics
- `titleBarStyle: 'hiddenInset'` — window has no visible title bar.
- When sidebar is closed on macOS, `TopBar` adds `pl-[80px]` to avoid traffic light overlap.
- Dock icon is set via `app.dock.setIcon()` (not `BrowserWindow.icon`).

### Versioning
- `__APP_VERSION__` is a Vite-injected global (from `package.json`). Use it in the renderer for display.

### AI Providers
- Provider clients are in `packages/desktop/src/main/providers/`. Each exports a streaming function that yields delta text.
- Supported providers: OpenAI (`openai.ts`), Anthropic (`anthropic.ts`), LM Studio (`lmstudio.ts`), Google Gemini (`gemini.ts`).
- LM Studio uses the OpenAI-compatible API (`openai.ts` with a custom `baseURL`).
- Gemini uses `@google/genai` SDK and maps messages to `role: 'user' | 'model'` — use it as the reference for new providers.
- The **provider marketplace registry** at `packages/core/src/data/provider-registry.json` drives the provider picker UI. See `AGENTS.md` for the entry schema.
- MCP tool calls are handled in `packages/desktop/src/main/mcp/client.ts` and bridged via IPC.

### Cloudflare Worker
- `GET /latest` → returns `{ version, notes, url }` from GitHub Releases.
- `POST /feedback` → creates a GitHub Issue. Requires `GITHUB_TOKEN` secret in Worker env.
- Source is in `worker/src/index.ts`. Deploy with `wrangler deploy` from `worker/`.

## Commands
```bash
npm start          # Dev mode (electron-forge start)
npm run lint       # ESLint (TypeScript)
npm run make       # Package + create distributable
npm run make -- --platform darwin   # macOS only
npm run make -- --platform win32    # Windows only

cd worker && wrangler deploy        # Deploy Cloudflare Worker
```

## What Not To Do
- Don't add Node.js imports to renderer files.
- Don't use `@tailwind` directive syntax (v3 style) — this project uses Tailwind v4.
- Don't hardcode API keys anywhere; route them through IPC to `electron-store`.
- Don't add `icon_512x512@2x.png` to iconsets — `iconutil` treats it as a duplicate of `icon_512x512.png` and fails.
- Don't modify `brand/` — it's gitignored and meant to be removed; use `icons/` and `src/styles/` instead.
