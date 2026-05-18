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

This repo contains only the **Electron shell**. All shared React UI (components, hooks, stores, services, types) lives in [`OpenConduit/core`](https://github.com/OpenConduit/core) and is consumed as the **`@openconduit/core`** package installed from GitHub Packages.

```
packages/
  desktop/                   # Electron shell — only local package
    src/
      main.ts                # Electron entry: sets userData path, creates BrowserWindow
      preload.ts             # Context bridge — exposes window.api to renderer
      renderer.ts            # Renderer entry (imports App from @openconduit/core)
      index.css              # Global styles
      main/
        ipc.ts               # All IPC handlers (ai, mcp, settings, updater, feedback)
        providers/           # AI provider clients: openai.ts, anthropic.ts, lmstudio.ts, gemini.ts, ollama.ts
        routing.ts           # Intelligent model routing classifier
        mcp/
          client.ts          # MCP client (HTTP-SSE + stdio transports)
        store/
          settings.ts        # electron-store, key: "openconduit-settings"
      renderer/
        env.d.ts             # window.api type definition + __APP_VERSION__ global
        services/index.ts    # Re-exports from @openconduit/core/services
      shared/types.ts        # Re-exports all types from @openconduit/core/types
      styles/
        brand_tokens.css     # Brand CSS variables
        brand_tokens.json
icons/                       # App icons: icon.icns, favicon.ico, icon-*.png (rounded corners, transparent bg)
public/
  app-icon.png               # Brand icon served to renderer (About tab)
docs/brand/                  # Brand reference images (guidelines, palette, typography)
worker/                      # Cloudflare Worker source (update checks + feedback → GitHub Issues)

@openconduit/core            # External — node_modules/@openconduit/core/src/
  components/                # React UI: ChatArea, Sidebar, SettingsPanel, InputBar, etc.
  hooks/                     # useChat, useCompare, useBeforeSend, etc.
  stores/                    # Zustand stores: conversation, settings, ui, analytics, tasks, files
  services/                  # IPC service wrappers
  data/                      # provider-registry.json, mcp-registry.json
  types.ts                   # All shared TypeScript types
```

> Vite resolves `@openconduit/core` imports to `node_modules/@openconduit/core/src/` so TypeScript source is processed directly without a separate build step.

## Key Conventions

### Electron / IPC
- All Node.js / Electron APIs live in **main process** (`packages/desktop/src/main/`). Never import them in renderer code (i.e. in `@openconduit/core`).
- The context bridge in `packages/desktop/src/preload.ts` exposes `window.api` to the renderer; the full type is declared in `packages/desktop/src/renderer/env.d.ts`.
- IPC channels follow the pattern `ai:*`, `mcp:*`, `settings:*`, `updater:*`.
- `app.setPath('userData', path.join(app.getPath('appData'), 'openconduit'))` is called before `createWindow` so the path never changes on rename.

### Tailwind CSS v4
- Use `@import "tailwindcss"` in CSS files — **not** `@tailwind base/components/utilities`.
- Brand colors are available as Tailwind classes: `brand-blue`, `brand-violet`, `brand-cyan`, `brand-navy`, `brand-surface`, `brand-muted`, `brand-white`.
- CSS variables from `packages/desktop/src/styles/brand_tokens.css` are also globally available: `var(--color-primary)`, `var(--color-surface)`, etc.
- Dark mode uses `class` strategy.

### State Management
- Zustand stores in renderer only (`@openconduit/core`). Main process state lives in `electron-store`.
- Do not persist sensitive data (API keys) in Zustand — those go through IPC to `settings.ts`.

### macOS specifics
- `titleBarStyle: 'hiddenInset'` — window has no visible title bar.
- When sidebar is closed on macOS, `TopBar` adds `pl-[80px]` to avoid traffic light overlap.
- Dock icon is set via `app.dock.setIcon()` (not `BrowserWindow.icon`).

### Versioning
- `__APP_VERSION__` is a Vite-injected global (from `package.json`). Use it in the renderer for display.

### AI Providers
- Provider clients are in `packages/desktop/src/main/providers/`. Each exports a streaming function that yields delta text.
- Supported providers: OpenAI (`openai.ts`), Anthropic (`anthropic.ts`), LM Studio (`lmstudio.ts`), Google Gemini (`gemini.ts`), Ollama (`ollama.ts`).
- LM Studio uses the OpenAI-compatible API (`openai.ts` with a custom `baseURL`).
- Gemini uses `@google/genai` SDK and maps messages to `role: 'user' | 'model'` — use it as the reference for new providers.
- The **provider marketplace registry** lives in [`OpenConduit/core`](https://github.com/OpenConduit/core) at `src/data/provider-registry.json`. See `AGENTS.md` for the entry schema.
- MCP tool calls are handled in `packages/desktop/src/main/mcp/client.ts` and bridged via IPC.

### Cloudflare Worker
- `GET /latest` → returns `{ version, notes, url }` from GitHub Releases.
- `POST /feedback` → creates a GitHub Issue. Requires `GITHUB_TOKEN` secret in Worker env.
- Source is in `worker/src/index.ts`. Deploy with `wrangler deploy` from `worker/`.

### Installing @openconduit/core
The package is published to GitHub Packages. Contributors need a GitHub PAT with `read:packages` scope:
```bash
export NODE_AUTH_TOKEN=<your-github-pat>
npm install
```
CI/CD workflows use `secrets.GITHUB_TOKEN` automatically.

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
- Don't add Node.js imports to renderer code (i.e. `@openconduit/core` source).
- Don't use `@tailwind` directive syntax (v3 style) — this project uses Tailwind v4.
- Don't hardcode API keys anywhere; route them through IPC to `electron-store`.
- Don't add `icon_512x512@2x.png` to iconsets — `iconutil` treats it as a duplicate of `icon_512x512.png` and fails.
- Don't modify `brand/` — it's gitignored and meant to be removed; use `icons/` and `src/styles/` instead.
- Don't edit UI components or stores in `node_modules/` — make changes in the [`OpenConduit/core`](https://github.com/OpenConduit/core) repo and publish a new version.
