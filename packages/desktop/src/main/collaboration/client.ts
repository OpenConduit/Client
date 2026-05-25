/**
 * CollaborationClient — manages a single WebSocket connection to a
 * ConversationRoom Durable Object on share.openconduit.ai.
 *
 * Lives in the Electron main process. Bridges IPC calls from the renderer
 * and pushes room events back via webContents.send('collab:event', event).
 */

import { BrowserWindow } from 'electron';
import type { ClientEvent, ServerEvent } from './types';
import { getSettings } from '../store/settings';

export type { ClientEvent, ServerEvent };

const DEFAULT_SHARE_BASE = 'https://share.openconduit.ai';

/** Returns the configured base HTTP URL (falls back to the hosted service). */
function shareBase(): string {
  return getSettings().selfHosting?.shareServerUrl?.replace(/\/$/, '') || DEFAULT_SHARE_BASE;
}

/** Derives the WebSocket base URL from the HTTP base URL. */
function wsBase(): string {
  return shareBase().replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

/** Maximum reconnect delay in ms (exponential backoff caps here). */
const MAX_BACKOFF_MS = 16_000;

interface RoomSession {
  roomId: string;
  ws: WebSocket;
  reconnectDelay: number;
  reconnecting: boolean;
  destroyed: boolean;
}

let session: RoomSession | null = null;

// ─── Public API (called from ipc.ts) ─────────────────────────────────────────

/** Create a new room, optionally seeding it with an existing conversation. */
export async function createRoom(seed?: unknown): Promise<{ roomId: string; wsUrl: string; inviteUrl: string }> {
  const res = await fetch(`${shareBase()}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: seed ? JSON.stringify(seed) : '{}',
  });
  if (!res.ok) throw new Error(`Failed to create room: ${res.status}`);
  return res.json() as Promise<{ roomId: string; wsUrl: string; inviteUrl: string }>;
}

/** Connect to an existing room. Triggers a 'sync' event on success. */
export function joinRoom(roomId: string, name: string, color: string): void {
  if (session) destroySession();

  const ws = new WebSocket(`${wsBase()}/rooms/${roomId}`);
  session = { roomId, ws, reconnectDelay: 1_000, reconnecting: false, destroyed: false };

  ws.addEventListener('open', () => {
    session!.reconnectDelay = 1_000;
    send({ type: 'join', name, color });
  });

  ws.addEventListener('message', (ev) => {
    try {
      const event = JSON.parse(ev.data as string) as ServerEvent;
      pushToRenderer(event);
    } catch { /* malformed frame — ignore */ }
  });

  ws.addEventListener('close', () => {
    if (session?.destroyed) return;
    scheduleReconnect(roomId, name, color);
  });

  ws.addEventListener('error', () => {
    // 'close' fires right after; reconnect logic lives there
  });
}

/** Disconnect from the current room. */
export function leaveRoom(): void {
  if (session) {
    send({ type: 'leave' });
    destroySession();
  }
}

/** Send a ClientEvent to the room. No-op if not connected. */
export function sendToRoom(event: ClientEvent): void {
  send(event);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function send(event: ClientEvent): void {
  if (session?.ws.readyState === WebSocket.OPEN) {
    session.ws.send(JSON.stringify(event));
  }
}

function destroySession(): void {
  if (!session) return;
  session.destroyed = true;
  try { session.ws.close(); } catch { /* already closed */ }
  session = null;
}

function scheduleReconnect(roomId: string, name: string, color: string): void {
  if (!session || session.destroyed) return;
  const delay = session.reconnectDelay;
  session.reconnectDelay = Math.min(delay * 2, MAX_BACKOFF_MS);
  session.reconnecting = true;

  pushToRenderer({ type: 'error', message: `Disconnected — reconnecting in ${delay / 1000}s` } as ServerEvent);

  setTimeout(() => {
    if (!session || session.destroyed) return;
    joinRoom(roomId, name, color);
  }, delay);
}

function pushToRenderer(event: ServerEvent): void {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) win.webContents.send('collab:event', event);
  }
}
