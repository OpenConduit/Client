// Types have been moved to @openconduit/core.
// This stub re-exports everything so main-process code keeps working unchanged.
export * from '@openconduit/core/types';

// ── Local augmentation ────────────────────────────────────────────────────────
// `manifest?` was added to InstalledExtensionInfo in the core repo (Phase 5).
// Re-declare the type here until a new @openconduit/core version is published
// and the dependency is bumped.
import type { InstalledExtensionInfo as _Base } from '@openconduit/core/types';
export type InstalledExtensionInfo = _Base & {
  /**
   * Pre-read contents of the extension's `manifest.json`.
   * Populated by the Electron preload; enables Phase 5 sandboxed lazy activation.
   */
  manifest?: {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    contributes?: {
      activityBarItems?: Array<{
        panelId: string;
        label: string;
        iconSvg?: string;
        order?: number;
      }>;
      settings?: Array<{
        key: string;
        type: 'string' | 'boolean' | 'number';
        default: string | boolean | number;
        title?: string;
        description?: string;
      }>;
    };
  };
};

