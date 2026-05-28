/**
 * Search engine dispatch for the web_search built-in tool.
 *
 * - DuckDuckGo: browser-based (no key, always available)
 * - Brave / Tavily / Exa / Jina: direct API calls (require API key)
 */

import { net } from 'electron';
import { searchWithBrowser, searchWithGoogle, searchWithBing, type SearchResult } from './browser';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function jsonFetch<T>(
  url: string,
  options: { headers?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const res = await net.fetch(url, {
    method: options.body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Engine implementations ───────────────────────────────────────────────────

async function searchBrave(
  query: string,
  apiKey: string,
  maxResults: number,
  exclude: string[],
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, count: String(maxResults) });
  const data = await jsonFetch<{ web?: { results?: Array<{ title: string; url: string; description?: string }> } }>(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    { headers: { 'X-Subscription-Token': apiKey } },
  );
  return (data.web?.results ?? [])
    .filter((r) => !exclude.some((h) => r.url.includes(h)))
    .slice(0, maxResults)
    .map((r) => ({ title: r.title, url: r.url, snippet: r.description ?? '' }));
}

async function searchTavily(
  query: string,
  apiKey: string,
  maxResults: number,
  exclude: string[],
): Promise<SearchResult[]> {
  const data = await jsonFetch<{ results?: Array<{ title: string; url: string; content?: string }> }>(
    'https://api.tavily.com/search',
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      body: {
        query,
        max_results: maxResults,
        exclude_domains: exclude,
        include_answer: false,
      },
    },
  );
  return (data.results ?? [])
    .slice(0, maxResults)
    .map((r) => ({ title: r.title, url: r.url, snippet: r.content ?? '' }));
}

async function searchExa(
  query: string,
  apiKey: string,
  maxResults: number,
  exclude: string[],
): Promise<SearchResult[]> {
  const data = await jsonFetch<{ results?: Array<{ title: string; url: string; snippet?: string }> }>(
    'https://api.exa.ai/search',
    {
      headers: { 'x-api-key': apiKey },
      body: {
        query,
        numResults: maxResults,
        excludeDomains: exclude,
        contents: { snippet: true },
      },
    },
  );
  return (data.results ?? [])
    .slice(0, maxResults)
    .map((r) => ({ title: r.title ?? '', url: r.url, snippet: r.snippet ?? '' }));
}

async function searchJina(
  query: string,
  apiKey: string,
  maxResults: number,
  exclude: string[],
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const data = await jsonFetch<{ data?: Array<{ title: string; url: string; description?: string }> }>(
    `https://s.jina.ai/${encodeURIComponent(query)}?${params}`,
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } },
  );
  return (data.data ?? [])
    .filter((r) => !exclude.some((h) => r.url.includes(h)))
    .slice(0, maxResults)
    .map((r) => ({ title: r.title ?? '', url: r.url, snippet: r.description ?? '' }));
}

async function searchGoogleApi(
  query: string,
  apiKey: string,
  cx: string,
  maxResults: number,
  exclude: string[],
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    num: String(Math.min(maxResults, 10)), // Custom Search JSON API max is 10
  });
  const data = await jsonFetch<{ items?: Array<{ title: string; link: string; snippet?: string }> }>(
    `https://www.googleapis.com/customsearch/v1?${params}`,
  );
  return (data.items ?? [])
    .filter((r) => !exclude.some((h) => r.link.includes(h)))
    .slice(0, maxResults)
    .map((r) => ({ title: r.title, url: r.link, snippet: r.snippet ?? '' }));
}

// ─── Public dispatch ─────────────────────────────────────────────────────────────────────

export type SearchEngine = 'duckduckgo' | 'google' | 'google-api' | 'bing' | 'brave' | 'tavily' | 'exa' | 'jina';

export interface SearchOptions {
  engine: SearchEngine;
  apiKey?: string;
  /** Google Custom Search Engine ID (CX), required for 'google-api' */
  googleCx?: string;
  maxResults: number;
  showBrowser: boolean;
  excludeWebsites?: string[];
}

export async function dispatchSearch(
  query: string,
  opts: SearchOptions,
): Promise<SearchResult[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 5, 1), 20);
  const exclude = opts.excludeWebsites ?? [];

  switch (opts.engine) {
    case 'duckduckgo':
      return searchWithBrowser(query, opts.showBrowser, max);

    case 'google':
      return searchWithGoogle(query, opts.showBrowser, max);

    case 'google-api': {
      if (!opts.apiKey) throw new Error('Google Custom Search requires an API key.');
      if (!opts.googleCx) throw new Error('Google Custom Search requires a Search Engine ID (CX).');
      const filtered = await searchGoogleApi(query, opts.apiKey, opts.googleCx, max, exclude);
      return filtered;
    }

    case 'bing':
      return searchWithBing(query, opts.showBrowser, max);

    case 'brave':
      if (!opts.apiKey) throw new Error('Brave Search requires an API key.');
      return searchBrave(query, opts.apiKey, max, exclude);

    case 'tavily':
      if (!opts.apiKey) throw new Error('Tavily requires an API key.');
      return searchTavily(query, opts.apiKey, max, exclude);

    case 'exa':
      if (!opts.apiKey) throw new Error('Exa requires an API key.');
      return searchExa(query, opts.apiKey, max, exclude);

    case 'jina':
      if (!opts.apiKey) throw new Error('Jina AI requires an API key.');
      return searchJina(query, opts.apiKey, max, exclude);

    default:
      throw new Error(`Unknown search engine: ${opts.engine as string}`);
  }
}
