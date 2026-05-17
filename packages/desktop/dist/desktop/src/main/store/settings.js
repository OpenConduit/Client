import Store from 'electron-store';
const defaults = {
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
export const settingsStore = new Store({
    name: 'openconduit-settings',
    defaults,
    encryptionKey: 'openconduit-v1',
});
export function getSettings() {
    return settingsStore.store;
}
export function setSettings(partial) {
    for (const [k, v] of Object.entries(partial)) {
        settingsStore.set(k, v);
    }
    return settingsStore.store;
}
//# sourceMappingURL=settings.js.map