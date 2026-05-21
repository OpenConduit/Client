/**
 * Singleton hidden BrowserWindow used by the web tools (web_fetch, web_search).
 *
 * A single window is reused across calls to avoid the overhead of creating a
 * new BrowserWindow for every tool invocation. When `showBrowser` is false the
 * window stays hidden; when true it is shown so the user can watch the page
 * load (e.g. for sites requiring CAPTCHA or login).
 */

import { BrowserWindow, session } from 'electron';

let _win: BrowserWindow | null = null;
// Serialise all calls through the hidden window so concurrent tool calls
// never share event-listener state or interrupt each other's loadURL /
// executeJavaScript sequences.
let _queue: Promise<unknown> = Promise.resolve();

function getWindow(): BrowserWindow {
  if (_win && !_win.isDestroyed()) return _win;

  _win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Use a dedicated partition so web tool browsing doesn't share cookies
      // with any renderer session, and vice-versa.
      session: session.fromPartition('persist:webtools', { cache: true }),
    },
  });

  _win.on('closed', () => { _win = null; });

  // When the hidden window's renderer crashes, null the reference so the
  // next call gets a fresh window instead of hitting a dead webContents.
  _win.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[webtools] hidden browser renderer gone: ${details.reason} (exit ${details.exitCode})`);
    if (_win && !_win.isDestroyed()) _win.destroy();
    _win = null;
  });

  return _win;
}

/** Load a URL in the browser window and wait until it stops loading. */
async function loadAndWait(win: BrowserWindow, url: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      win.webContents.off('did-stop-loading', onStop);
      win.webContents.off('did-fail-load', onFail);
    };

    const onStop = () => {
      cleanup();
      resolve();
    };

    // did-fail-load fires for sub-frame resources too (ads, trackers that get
    // blocked). Only treat it as fatal when it's the main frame AND the code
    // is not ERR_ABORTED (-3), which fires on redirects / intentional aborts.
    const onFail = (
      _e: Electron.Event,
      code: number,
      desc: string,
      _validatedUrl: string,
      isMainFrame: boolean,
    ) => {
      if (!isMainFrame || code === -3) return;
      cleanup();
      reject(new Error(`Failed to load ${url}: ${desc} (${code})`));
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out loading ${url}`));
    }, timeoutMs);

    win.webContents.on('did-stop-loading', onStop);
    win.webContents.on('did-fail-load', onFail);

    win.loadURL(url).catch((err: unknown) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Fetch a URL using the hidden browser window and return the page's readable
 * text content. Falls back to a blank string on extraction failure.
 */
export function fetchUrlWithBrowser(
  url: string,
  show = false,
): Promise<string> {
  const task = async (): Promise<string> => {
    const win = getWindow();
    if (show) win.show();
    try {
      await loadAndWait(win, url);
      const text: string = await win.webContents.executeJavaScript(`
      (() => {
        // Remove noise elements
        ['script','style','noscript','nav','header','footer','aside',
         '[role="banner"]','[role="navigation"]','[role="complementary"]',
         '[aria-hidden="true"]'].forEach(sel => {
          document.querySelectorAll(sel).forEach(el => el.remove());
        });
        // Prefer article/main, fall back to body
        const main =
          document.querySelector('article') ||
          document.querySelector('main') ||
          document.querySelector('[role="main"]') ||
          document.body;
        return (main?.innerText ?? '').replace(/\\n{3,}/g, '\\n\\n').trim();
      })()
    `);

      return text;
    } finally {
      if (show) win.hide();
    }
  };
  return (_queue = _queue.then(task, task) as Promise<string>);
}

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * Perform a DuckDuckGo Lite search via the browser window.
 */
export function searchWithBrowser(
  query: string,
  show = false,
  maxResults = 5,
): Promise<SearchResult[]> {
  const task = async (): Promise<SearchResult[]> => {
    const win = getWindow();
    if (show) win.show();
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

  try {
    await loadAndWait(win, searchUrl);

    const results: SearchResult[] = await win.webContents.executeJavaScript(`
      (() => {
        const rows = Array.from(document.querySelectorAll('table tr'));
        const out = [];
        let current = {};
        for (const row of rows) {
          const link = row.querySelector('a.result-link');
          const snippet = row.querySelector('.result-snippet');
          if (link) {
            if (current.title) out.push(current);
            current = { title: link.textContent.trim(), url: link.href, snippet: '' };
          } else if (snippet && current.title) {
            current.snippet = snippet.textContent.trim();
          }
          if (out.length >= ${maxResults}) break;
        }
        if (current.title && out.length < ${maxResults}) out.push(current);
        return out;
      })()
    `);

      return results.slice(0, maxResults);
    } finally {
      if (show) win.hide();
    }
  };
  return (_queue = _queue.then(task, task) as Promise<SearchResult[]>);
}

/**
 * Perform a Google search via the browser and extract organic results.
 * Waits for JS-rendered results to appear in the DOM before scraping.
 */
export function searchWithGoogle(
  query: string,
  show = false,
  maxResults = 5,
): Promise<SearchResult[]> {
  const task = async (): Promise<SearchResult[]> => {
    const win = getWindow();
    if (show) win.show();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${maxResults}`;

  try {
    await loadAndWait(win, searchUrl);

    // Google renders results via JS after did-stop-loading. Poll until h3
    // elements appear in #rso/#search, or give up after 8 seconds.
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const deadline = Date.now() + 8000;
        const poll = () => {
          const found = document.querySelectorAll('#rso h3, #search h3').length > 0;
          if (found || Date.now() > deadline) resolve(null);
          else setTimeout(poll, 300);
        };
        poll();
      })
    `);

    const results: SearchResult[] = await win.webContents.executeJavaScript(`
      (() => {
        const out = [];
        document.querySelectorAll('#rso h3, #search h3').forEach(h3 => {
          const a = h3.closest('a') ?? h3.parentElement?.closest('a');
          if (!a?.href?.startsWith('http')) return;
          const block = h3.closest('[data-ved]') ?? h3.closest('[class]');
          const snippetEl = block?.querySelector('.VwiC3b, [data-sncf], .ITZIwc') ??
            Array.from(block?.querySelectorAll('span') ?? []).find(s => (s.textContent ?? '').length > 40);
          out.push({
            title: h3.textContent.trim(),
            url: a.href,
            snippet: (snippetEl?.textContent ?? '').trim(),
          });
        });
        return out.slice(0, ${maxResults});
      })()
    `);

    return results.slice(0, maxResults);
    } finally {
      if (show) win.hide();
    }
  };
  return (_queue = _queue.then(task, task) as Promise<SearchResult[]>);
}

/**
 * Perform a Bing search via the browser and extract organic results.
 */
export function searchWithBing(
  query: string,
  show = false,
  maxResults = 5,
): Promise<SearchResult[]> {
  const task = async (): Promise<SearchResult[]> => {
    const win = getWindow();
    if (show) win.show();
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`;

  try {
    await loadAndWait(win, searchUrl);

    const results: SearchResult[] = await win.webContents.executeJavaScript(`
      (() => {
        const out = [];
        document.querySelectorAll('li.b_algo').forEach(el => {
          const a = el.querySelector('h2 a');
          const snippetEl = el.querySelector('.b_caption p') ?? el.querySelector('.b_algoSlug');
          if (!a) return;
          out.push({ title: a.textContent.trim(), url: a.href, snippet: (snippetEl?.textContent ?? '').trim() });
        });
        return out.slice(0, ${maxResults});
      })()
    `);

    return results.slice(0, maxResults);
  } finally {
    if (show) win.hide();
  }
};
  return (_queue = _queue.then(task, task) as Promise<SearchResult[]>);
}

/** Destroy the singleton window (call on app quit). */
export function destroyBrowserWindow(): void {
  if (_win && !_win.isDestroyed()) _win.destroy();
  _win = null;
}
