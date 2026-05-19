import Store from 'electron-store';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { AppSettings } from '../../shared/types';


const defaults: AppSettings = {
  theme: 'system',
  providers: [],
  mcpServers: [],
  defaultParameters: {
    temperature: 0.7,
    topP: 1,
    maxTokens: 4096,
  },
  requireToolApproval: true,
  updateChannel: 'stable',
  features: {},
  labs: {
    aiTaskTracking: false,
    aiClarifyingQuestions: false,
    debugMode: false,
  },
};

function createSettingsStore() {
  return new Store<AppSettings>({
    name: 'openconduit-settings',
    defaults,
  } as any) as any;
}

/**
 * Migrate from the old encrypted store (pre-#37).
 * Reads settings using the old encryption key, deletes the encrypted file,
 * then returns the decrypted data so it can be written to the new plain store.
 * Users keep all their settings (API keys, providers, etc.).
 */
function decryptLegacyStore(): Partial<AppSettings> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const EncStore = Store as any;
    const encryptedStore = new EncStore({
      name: 'openconduit-settings',
      defaults,
      encryptionKey: 'openconduit-v1',
    });
    return { ...(encryptedStore.store as object) } as Partial<AppSettings>;
  } catch {
    return null;
  }
}

const storePath = join(app.getPath('userData'), 'openconduit-settings.json');
let _migratedData: Partial<AppSettings> | null = null;

if (existsSync(storePath)) {
  try {
    JSON.parse(readFileSync(storePath, 'utf-8'));
  } catch {
    // File is not valid JSON — decrypt with old key, then delete
    _migratedData = decryptLegacyStore();
    unlinkSync(storePath);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const settingsStore = createSettingsStore();

// Restore decrypted settings into the new plain store
if (_migratedData) {
  for (const [k, v] of Object.entries(_migratedData)) {
    if (v !== undefined) settingsStore.set(k, v);
  }
}

export function getSettings(): AppSettings {
  return settingsStore.store as AppSettings;
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
  for (const [k, v] of Object.entries(partial)) {
    settingsStore.set(k, v);
  }
  return settingsStore.store as AppSettings;
}
