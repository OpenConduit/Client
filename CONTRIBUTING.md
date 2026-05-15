# Contributing to OpenConduit

Thanks for your interest in contributing! Please read this before opening a PR.

## Getting started

```bash
git clone https://github.com/OpenConduit/Client.git
cd Client
npm install
npm start        # dev mode
npm run lint     # lint check
npx tsc --noEmit # type check
```

## Architecture rules

OpenConduit uses Electron with `contextIsolation: true`. The #1 rule:

> **Never import Node.js or Electron APIs in renderer files.**

All Node/Electron code lives in `src/main/`. Communication with the renderer goes through the IPC bridge in `src/preload.ts` (exposed as `window.api`). IPC channels follow the pattern `ai:*`, `mcp:*`, `settings:*`, `updater:*`.

If you need a new capability in the renderer, add an IPC handler in `src/main/ipc.ts` and expose it in `src/preload.ts`.

## Commit format

This project uses [Conventional Commits](https://www.conventionalcommits.org). Your commit messages directly control the changelog and version bump:

| Prefix | Example | Effect |
|---|---|---|
| `feat:` | `feat: add Gemini provider` | minor bump, shown in changelog |
| `fix:` | `fix: crash on empty system prompt` | patch bump, shown in changelog |
| `feat!:` | `feat!: redesign settings schema` | **major** bump |
| `perf:` | `perf: reduce re-renders in MessageList` | patch bump |
| `docs:` | `docs: update MCP setup guide` | no bump |
| `chore:` | `chore: update dependencies` | no bump |
| `ci:` | `ci: fix release artifact path` | no bump |
| `refactor:` | `refactor: extract useScroll hook` | no bump |

For breaking changes, add `BREAKING CHANGE: <description>` in the commit body, or use the `!` suffix on any type.

A pre-commit hook (husky) runs `npm run lint` and `npx tsc --noEmit` automatically. Fix any errors before committing.

## Pull requests

1. Branch off `main`
2. Keep PRs focused — one feature or fix per PR
3. Ensure `npm run lint` and `npx tsc --noEmit` pass
4. Sign the [Contributor License Agreement](CLA.md) — the CLA bot will prompt you on your first PR

## Releases

Releases are automated. You do not need to bump the version or edit `CHANGELOG.md` manually.

**Stable release:**
After merging enough `feat:` / `fix:` commits, release-please opens a Release PR. Merge it → tag is created → CI builds macOS DMG, Windows EXE, Linux deb/rpm → draft GitHub Release is created for review.

**Beta release:**
Tag manually and push:
```bash
git tag v1.1.0-beta.1 && git push origin v1.1.0-beta.1
```
CI builds all platforms and publishes immediately as a pre-release on GitHub (no draft, no website deploy).

## Styling

- Tailwind CSS v4 — use `@import "tailwindcss"`, not `@tailwind` directives
- Brand colors: `brand-blue`, `brand-violet`, `brand-cyan`, `brand-navy`, `brand-surface`, `brand-muted`, `brand-white`
- CSS variables: `var(--color-primary)`, `var(--color-surface)`, etc. (defined in `src/styles/brand_tokens.css`)
- Dark mode uses the `class` strategy

## Sensitive data

API keys and secrets must never be stored in Zustand or committed to the repo. They go through IPC to `electron-store` (main process only). See `src/main/store/settings.ts`.
