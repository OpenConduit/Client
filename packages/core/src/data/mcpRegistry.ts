import type { McpTransport } from '../types';
import rawRegistry from './mcp-registry.json';

export interface McpRegistryEntry {
  id: string;
  name: string;
  description: string;
  category: 'search' | 'dev' | 'data' | 'productivity' | 'local' | 'ai';
  icon: string;
  transport: McpTransport;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  requiresApiKey?: boolean;
  apiKeyEnvVar?: string;
  setupUrl?: string;
  notes?: string;
  badge?: 'Free' | 'API Key' | 'Self-hosted' | 'Local install';
}

export const MCP_REGISTRY: McpRegistryEntry[] = rawRegistry as McpRegistryEntry[];

export const MCP_CATEGORIES: { id: McpRegistryEntry['category'] | 'all'; label: string }[] = [
  { id: 'all',          label: 'All' },
  { id: 'search',       label: 'Search' },
  { id: 'dev',          label: 'Developer' },
  { id: 'data',         label: 'Data' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'ai',           label: 'AI Tools' },
];
