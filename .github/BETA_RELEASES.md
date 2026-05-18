# Beta & Alpha Release Channels

OpenConduit supports three release channels for distributing updates: **stable**, **beta**, and **alpha**.

## Overview

- **Stable** (`stable`): Official releases, e.g. `v1.2.1` — for production users
- **Beta** (`beta`): Pre-release testing versions, e.g. `v1.3.0-beta.1` — for early adopters
- **Alpha** (`alpha`): Early testing versions, e.g. `v1.3.0-alpha.1` — for developers

## How It Works

### Cloudflare Worker

The update check endpoint at `https://workers.openconduit.ai/latest` accepts a `channel` query parameter:

```
GET /latest?channel=stable|beta|alpha
```

**Behavior:**
- **`?channel=stable`** (default): Returns the latest GitHub release (non-prerelease)
- **`?channel=beta`**: Scans recent releases for a prerelease tagged with "beta" (e.g., `v1.3.0-beta`)
- **`?channel=alpha`**: Scans recent releases for a prerelease tagged with "alpha" or "beta"

### Tagging Releases

When you create a GitHub release:

1. **Stable release**: Tag as `v1.2.1` (no prerelease suffix)
   - Check the "Set as a pre-release" checkbox: **OFF**
   - Stable users will receive this update

2. **Beta release**: Tag as `v1.3.0-beta` or `v1.3.0-beta.1`
   - Check the "Set as a pre-release" checkbox: **ON**
   - Beta users will receive this update
   - Stable users will NOT receive it

3. **Alpha release**: Tag as `v1.3.0-alpha` or `v1.3.0-alpha.1`
   - Check the "Set as a pre-release" checkbox: **ON**
   - Alpha users will receive this update
   - Beta and stable users will NOT receive it (unless no beta is available, then they fall back to stable)

## Client Configuration

In `packages/desktop/src/main/ipc.ts` (or wherever your updater is):

```typescript
// Determine which channel to check
const channel = 'stable'; // or 'beta', 'alpha' depending on build variant

// Check for updates
const response = await fetch(
  `https://workers.openconduit.ai/latest?channel=${channel}`
);
const { version, notes, url } = await response.json();
```

## Development Workflow

### Testing a Beta Release

1. Create a GitHub release tagged `v1.3.0-beta.1`
2. Mark it as pre-release
3. Beta users (with `channel=beta` in their client) will see the update available
4. Test thoroughly

### Promoting Beta to Stable

1. Create a new release tagged `v1.3.0` (remove the `-beta` suffix)
2. Uncheck "Set as pre-release"
3. All users (stable, beta, alpha) will receive the update

### Fallback Behavior

If no matching pre-release is found, the worker falls back to the latest stable release. This ensures users always get an update, even if their channel doesn't have recent releases.

## Implementation Notes

- The Cloudflare Worker scans the **20 most recent releases** when looking for beta/alpha builds
- Release notes and download URL are included in the response
- If a user is on a channel with no available releases, they fall back to stable
