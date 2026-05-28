import fs from 'node:fs';
import path from 'node:path';
import {
  init,
  add,
  commit,
  push,
  pull,
  fetch as gitFetch,
  checkout,
  addRemote,
  deleteRemote,
  listRemotes,
  log as gitLog,
  statusMatrix,
  resolveRef,
} from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import type { SyncPayload, SyncStatusResult } from '../../shared/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTHOR = { name: 'OpenConduit', email: 'sync@openconduit.ai' };
const BRANCH = 'main';
const README_CONTENT = [
  '# OpenConduit Sync',
  '',
  'This repository is managed by [OpenConduit](https://openconduit.ai).',
  'It stores a versioned backup of your conversations, personas, prompt templates, and settings.',
  '',
  '> **Do not edit files in this repo manually** \u2014 changes will be overwritten on the next sync.',
  '',
  '## Contents',
  '',
  '| Path | Description |',
  '|------|-------------|',
  '| `conversations/` | One JSON file per conversation |',
  '| `personas.json` | AI personas |',
  '| `prompts.json` | Prompt templates |',
  '| `settings.json` | Non-sensitive app settings |',
  '| `last-sync.txt` | Timestamp of the most recent sync |',
].join('\n');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeReadJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return undefined;
  }
}

function writeJson(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** Returns true when `dir` is an initialised git repository. */
async function isInitialised(dir: string): Promise<boolean> {
  try {
    await resolveRef({ fs, dir, ref: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}

/** Returns true when 'origin' remote is configured. */
async function hasRemote(dir: string): Promise<boolean> {
  try {
    const remotes = await listRemotes({ fs, dir });
    return remotes.some((r) => r.remote === 'origin');
  } catch {
    return false;
  }
}

/** Returns the author date of the most-recent commit on HEAD, or null. */
async function latestCommitTime(dir: string): Promise<number | null> {
  try {
    const [entry] = await gitLog({ fs, dir, depth: 1 });
    if (!entry) return null;
    return (entry.commit.author.timestamp ?? 0) * 1000;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Create the repo directory and run `git init` if not already initialised. */
export async function initRepo(dir: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });
  if (!(await isInitialised(dir))) {
    await init({ fs, dir, defaultBranch: BRANCH });
  }
  // Write a README on first init (skip if already exists)
  const readmePath = path.join(dir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, README_CONTENT, 'utf-8');
  }
}

/**
 * Add or update the 'origin' remote.
 * No-op when `remoteUrl` is empty.
 */
export async function configureRemote(dir: string, remoteUrl: string): Promise<void> {
  if (!remoteUrl) return;
  const remotes = await listRemotes({ fs, dir });
  const existing = remotes.find((r) => r.remote === 'origin');
  if (existing) {
    await deleteRemote({ fs, dir, remote: 'origin' });
  }
  await addRemote({ fs, dir, remote: 'origin', url: remoteUrl });
}

/**
 * Serialise a `SyncPayload` to the repo working tree.
 * - `conversations/<id>.json` for each conversation
 * - `personas.json`, `prompts.json`, `settings.json` for the rest
 * Removes conversation files that no longer exist in the payload.
 */
export async function writePayload(dir: string, payload: SyncPayload): Promise<void> {
  if (payload.conversations) {
    const convoDir = path.join(dir, 'conversations');
    fs.mkdirSync(convoDir, { recursive: true });

    // Remove files for conversations that are no longer in the payload
    const incoming = new Set(Object.keys(payload.conversations));
    if (fs.existsSync(convoDir)) {
      for (const file of fs.readdirSync(convoDir)) {
        if (file.endsWith('.json')) {
          const id = file.replace(/\.json$/, '');
          if (!incoming.has(id)) {
            fs.unlinkSync(path.join(convoDir, file));
          }
        }
      }
    }

    for (const [id, convo] of Object.entries(payload.conversations)) {
      writeJson(path.join(convoDir, `${id}.json`), convo);
    }
  }

  if (payload.personas !== undefined) {
    writeJson(path.join(dir, 'personas.json'), payload.personas);
  }
  if (payload.prompts !== undefined) {
    writeJson(path.join(dir, 'prompts.json'), payload.prompts);
  }
  if (payload.settings !== undefined) {
    writeJson(path.join(dir, 'settings.json'), payload.settings);
  }

  // Always update the last-sync timestamp
  fs.writeFileSync(
    path.join(dir, 'last-sync.txt'),
    new Date().toISOString() + '\n',
    'utf-8',
  );

  // Backfill README if it was somehow missing
  const readmePath = path.join(dir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, README_CONTENT, 'utf-8');
  }
}

/** Read the repo working tree back into a `SyncPayload`. */
export function readPayload(dir: string): SyncPayload {
  const payload: SyncPayload = {};

  const convoDir = path.join(dir, 'conversations');
  if (fs.existsSync(convoDir)) {
    const conversations: Record<string, unknown> = {};
    for (const file of fs.readdirSync(convoDir)) {
      if (file.endsWith('.json')) {
        const id = file.replace(/\.json$/, '');
        const data = safeReadJson(path.join(convoDir, file));
        if (data !== undefined) conversations[id] = data;
      }
    }
    payload.conversations = conversations;
  }

  const personasPath = path.join(dir, 'personas.json');
  if (fs.existsSync(personasPath)) {
    payload.personas = safeReadJson(personasPath);
  }

  const promptsPath = path.join(dir, 'prompts.json');
  if (fs.existsSync(promptsPath)) {
    payload.prompts = safeReadJson(promptsPath);
  }

  const settingsPath = path.join(dir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    payload.settings = safeReadJson(settingsPath);
  }

  return payload;
}

/**
 * Stage all changes and create a commit.
 * Returns `false` when there is nothing to commit (working tree clean).
 */
export async function commitAll(dir: string): Promise<boolean> {
  await add({ fs, dir, filepath: '.' });

  const status = await statusMatrix({ fs, dir });
  const dirty = status.some(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1));
  if (!dirty) return false;

  await commit({
    fs,
    dir,
    author: AUTHOR,
    message: `sync: ${new Date().toISOString()}`,
  });
  return true;
}

/**
 * Push HEAD to origin/main.
 * Uses `force: true` for last-write-wins semantics.
 */
export async function pushToRemote(dir: string, token: string): Promise<void> {
  await push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: BRANCH,
    force: true,
    onAuth: () => ({ username: 'oauth2', password: token }),
  });
}

/**
 * Pull from origin/main.
 * If the local repo has no commits yet, performs a clone-style fetch + reset.
 */
export async function pullFromRemote(dir: string, token: string): Promise<void> {
  const hasCommits = (await latestCommitTime(dir)) !== null;

  if (!hasCommits) {
    // Fresh local repo — fetch first, then only checkout if the remote has commits
    try {
      await gitFetch({
        fs,
        http,
        dir,
        remote: 'origin',
        ref: BRANCH,
        onAuth: () => ({ username: 'oauth2', password: token }),
      });
    } catch {
      // Remote is empty or unreachable — nothing to pull, first push will seed it
      return;
    }

    // Verify the remote ref actually exists (empty remote = nothing fetched)
    try {
      await resolveRef({ fs, dir, ref: `refs/remotes/origin/${BRANCH}` });
    } catch {
      // Remote has no commits yet — skip checkout, first push will seed it
      return;
    }

    await checkout({
      fs,
      dir,
      ref: `refs/remotes/origin/${BRANCH}`,
      force: true,
    });
  } else {
    await pull({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: BRANCH,
      author: AUTHOR,
      onAuth: () => ({ username: 'oauth2', password: token }),
    });
  }
}

/** Return the current repository status without any side effects. */
export async function getRepoStatus(dir: string): Promise<SyncStatusResult> {
  if (!fs.existsSync(dir)) {
    return { initialized: false, remoteConfigured: false, lastCommitAt: null };
  }
  const initialized = await isInitialised(dir);
  const remoteConfigured = initialized && (await hasRemote(dir));
  const lastCommitAt = initialized ? await latestCommitTime(dir) : null;
  return { initialized, remoteConfigured, lastCommitAt };
}
