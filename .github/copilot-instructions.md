# OpenConduit — Copilot Instructions

## Project Overview
OpenConduit is a cross-platform desktop AI chat application built with Electron + React. It supports multiple AI providers (OpenAI, Anthropic, LM Studio), MCP (Model Context Protocol) tool servers, and is packaged with electron-forge for macOS, Windows, and Linux.

## Tech Stack
- **Runtime**: Electron 42 (contextIsolation: true, sandbox: false)
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite
- **State**: Zustand v5 with `persist` middleware
- **Settings (main process)**: `electron-store` v11
- **Build/package**: electron-forge (MakerSquirrel, MakerZIP, MakerDeb, MakerRpm)
- **Worker**: Cloudflare Worker at `https://openconduit.chumchal-account.workers.dev`

## Repository Structure
```
src/
  main.ts                    # Electron entry: sets userData path, creates BrowserWindow
  preload.ts                 # Context bridge — exposes window.api to renderer
  main/
    ipc.ts                   # All IPC handlers (ai, mcp, settings, updater, feedback)
    providers/               # AI provider clients: openai.ts, anthropic.ts, lmstudio.ts
    mcp/
      client.ts              # MCP client (HTTP-SSE + stdio transports)
    store/
      settings.ts            # electron-store, key: "openconduit-settings"
  renderer/
    App.tsx                  # Root component, layout
    components/
      ChatArea.tsx           # Main chat view
      Sidebar.tsx            # Conversation list
      TopBar.tsx             # Header with macOS traffic light spacing
      InputBar.tsx           # Message input
      MessageBubble.tsx      # Single message (supports markdown, tool calls)
      SettingsPanel.tsx      # All settings tabs + About tab
      ContextWarningBanner.tsx
      ToolCallCard.tsx
      TasksPanel.tsx
      SystemPromptEditor.tsx
    stores/
      conversationStore.ts   # persist key: "openconduit-conversations"
      settingsStore.ts       # Renderer-side settings mirror
      analyticsStore.ts      # persist key: "openconduit-analytics"
      tasksStore.ts
      uiStore.ts
  shared/
    types.ts                 # Shared TypeScript types (AppSettings, Message, etc.)
icons/                       # App icons: icon.icns, favicon.ico, icon-*.png (rounded corners, transparent bg)
public/
  app-icon.png               # Brand icon served to renderer (About tab)
src/styles/
  brand_tokens.css           # CSS custom properties (--color-primary, --color-surface, etc.)
  brand_tokens.json          # Same tokens as JSON
docs/brand/                  # Brand reference images (guidelines, palette, typography)
worker/                      # Cloudflare Worker source (update checks + feedback → GitHub Issues)
```

## Key Conventions

### Electron / IPC
- All Node.js / Electron APIs live in **main process** (`src/main/`). Never import them in renderer.
- The context bridge in `preload.ts` exposes `window.api` to the renderer.
- IPC channels follow the pattern `ai:*`, `mcp:*`, `settings:*`, `updater:*`.
- `app.setPath('userData', path.join(app.getPath('appData'), 'openconduit'))` is called before `createWindow` so the path never changes on rename.

### Tailwind CSS v4
- Use `@import "tailwindcss"` in CSS files — **not** `@tailwind base/components/utilities`.
- Brand colors are available as Tailwind classes: `brand-blue`, `brand-violet`, `brand-cyan`, `brand-navy`, `brand-surface`, `brand-muted`, `brand-white`.
- CSS variables from `src/styles/brand_tokens.css` are also globally available: `var(--color-primary)`, `var(--color-surface)`, etc.
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
- Provider clients are in `src/main/providers/`. Each exports a streaming function that yields delta text.
- LM Studio uses the OpenAI-compatible API (`openai.ts` with a custom `baseURL`).
- MCP tool calls are handled in `src/main/mcp/client.ts` and bridged via IPC.

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
