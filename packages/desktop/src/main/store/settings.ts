import Store from 'electron-store';
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

// electron-store is ESM; cast to any to work around TypeScript resolution quirks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const settingsStore = new Store<AppSettings>({
  name: 'openconduit-settings',
  defaults,
  encryptionKey: 'openconduit-v1',
} as any) as any;

export function getSettings(): AppSettings {
  return settingsStore.store as AppSettings;
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
  for (const [k, v] of Object.entries(partial)) {
    settingsStore.set(k, v);
  }
  return settingsStore.store as AppSettings;
}
