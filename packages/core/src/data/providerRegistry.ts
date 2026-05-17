import type { ProviderType } from '../types';
import rawRegistry from './provider-registry.json';

export interface ProviderRegistryEntry {
  id: string;
  name: string;
  description: string;
  category: 'cloud-proprietary' | 'cloud-opensource' | 'meta' | 'local' | 'enterprise' | 'custom';
  icon: string;
  type: ProviderType;
  baseUrl?: string;
  defaultModel?: string;
  requiresApiKey: boolean;
  apiKeyUrl?: string;
  badge: 'Free tier' | 'API Key' | 'Local' | 'Enterprise' | 'Free';
  notes?: string;
  modelCount?: string;
}

export const PROVIDER_REGISTRY: ProviderRegistryEntry[] = rawRegistry as ProviderRegistryEntry[];

export const PROVIDER_CATEGORIES: {
  id: ProviderRegistryEntry['category'] | 'all';
  label: string;
}[] = [
  { id: 'all',               label: 'All' },
  { id: 'cloud-proprietary', label: 'Cloud' },
  { id: 'cloud-opensource',  label: 'Open Source' },
  { id: 'meta',              label: 'Aggregators' },
  { id: 'local',             label: 'Local' },
  { id: 'enterprise',        label: 'Enterprise' },
  { id: 'custom',            label: 'Custom' },
];
