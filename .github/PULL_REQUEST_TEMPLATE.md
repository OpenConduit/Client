## Summary
<!-- What does this PR do? One or two sentences. -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Dependency update
- [ ] Docs / config only

## Process Boundary Check
- [ ] No Node.js / Electron APIs imported in renderer files (`src/renderer/`)
- [ ] Any new main↔renderer communication goes through IPC (`src/main/ipc.ts` + `preload.ts`)

## Testing
- [ ] Tested on macOS
- [ ] Tested on Windows
- [ ] Tested on Linux

## Checklist
- [ ] No API keys or secrets committed
- [ ] No `@tailwind` directive syntax (use `@import "tailwindcss"`)
- [ ] `npm run lint` passes
- [ ] `npm start` runs without errors
