/**
 * Built-in web tool handler for the main process.
 *
 * When the AI calls `web_fetch` or `web_search`, ipc.ts routes the tool call
 * here instead of to an MCP server. Results are returned in the same
 * McpToolResult shape so the rest of the pipeline is unchanged.
 */

import { net } from 'electron';
import { fetchUrlWithBrowser } from './browser';
import { dispatchSearch, type SearchEngine } from './engines';
import type { ToolCall, McpToolResult } from '../../shared/types';
import type { AppSettings } from '../../shared/types';

/** The serverId used for all built-in tool calls. */
export const BUILTIN_SERVER_ID = '__builtin__';

/** Names of all tools handled by this module. */
export const WEB_TOOL_NAMES = ['web_fetch', 'web_search'] as const;
export type WebToolName = (typeof WEB_TOOL_NAMES)[number];

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function runWebFetch(
  input: Record<string, unknown>,
  settings: AppSettings,
): Promise<string> {
  const url = input.url as string;
  const showBrowser =
    typeof input.showBrowser === 'boolean'
      ? input.showBrowser
      : (settings as unknown as Record<string, Record<string, boolean>>)?.webFetch
          ?.showBrowser ?? false;

  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  // For most pages use Electron's net module (fast, no JS rendering).
  // Fall back to the browser window when showBrowser is requested.
  if (showBrowser) {
    return fetchUrlWithBrowser(url, true);
  }

  const res = await net.fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

  const html = await res.text();
  return extractText(html);
}

/** Very lightweight HTML → readable-text extractor (no dependencies). */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 30_000); // cap at 30 k chars to stay within context windows
}

// ─── Search ───────────────────────────────────────────────────────────────────

async function runWebSearch(
  input: Record<string, unknown>,
  settings: AppSettings,
): Promise<string> {
  const query = input.query as string;
  if (!query) throw new Error('web_search: query is required');

  // Read extension settings via dot-path (stored at runtime by electron-store)
  const s = settings as unknown as Record<string, Record<string, unknown>>;
  const ws = s?.webSearch ?? {};

  const maxResults = Math.min(
    Math.max(
      typeof input.maxResults === 'number'
        ? input.maxResults
        : (typeof ws.maxResults === 'number' ? ws.maxResults : 5),
      1,
    ),
    20,
  );

  const results = await dispatchSearch(query, {
    engine: (ws.engine as SearchEngine) ?? 'duckduckgo',
    apiKey: ws.apiKey as string | undefined,
    googleCx: ws.googleCx as string | undefined,
    maxResults,
    showBrowser: (ws.showBrowser as boolean) ?? false,
    excludeWebsites: Array.isArray(ws.excludeWebsites)
      ? (ws.excludeWebsites as string[])
      : typeof ws.excludeWebsites === 'string'
        ? (ws.excludeWebsites as string)
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        : [],
  });

  return JSON.stringify(results, null, 2);
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Execute a built-in web tool call and return the result in McpToolResult
 * format so the ipc.ts pipeline can treat it identically to MCP results.
 */
export async function callWebTool(
  tc: ToolCall,
  settings: AppSettings,
): Promise<McpToolResult> {
  try {
    let result: string;
    if (tc.name === 'web_fetch') {
      result = await runWebFetch(tc.input, settings);
    } else if (tc.name === 'web_search') {
      result = await runWebSearch(tc.input, settings);
    } else {
      throw new Error(`Unknown built-in tool: ${tc.name}`);
    }
    return { toolName: tc.name, serverId: BUILTIN_SERVER_ID, result, isError: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { toolName: tc.name, serverId: BUILTIN_SERVER_ID, result: msg, isError: true };
  }
}
