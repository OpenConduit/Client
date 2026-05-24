import fs from 'node:fs';
import path from 'node:path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import type { SyncPayload, SyncStatusResult } from '../../shared/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTHOR = { name: 'OpenConduit', email: 'sync@openconduit.app' };
const BRANCH = 'main';

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
    await git.resolveRef({ fs, dir, ref: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}

/** Returns true when 'origin' remote is configured. */
async function hasRemote(dir: string): Promise<boolean> {
  try {
    const remotes = await git.listRemotes({ fs, dir });
    return remotes.some((r) => r.remote === 'origin');
  } catch {
    return false;
  }
}

/** Returns the author date of the most-recent commit on HEAD, or null. */
async function latestCommitTime(dir: string): Promise<number | null> {
  try {
    const [entry] = await git.log({ fs, dir, depth: 1 });
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
    await git.init({ fs, dir, defaultBranch: BRANCH });
  }
}

/**
 * Add or update the 'origin' remote.
 * No-op when `remoteUrl` is empty.
 */
export async function configureRemote(dir: string, remoteUrl: string): Promise<void> {
  if (!remoteUrl) return;
  const remotes = await git.listRemotes({ fs, dir });
  const existing = remotes.find((r) => r.remote === 'origin');
  if (existing) {
    await git.deleteRemote({ fs, dir, remote: 'origin' });
  }
  await git.addRemote({ fs, dir, remote: 'origin', url: remoteUrl });
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
  await git.add({ fs, dir, filepath: '.' });

  const status = await git.statusMatrix({ fs, dir });
  const dirty = status.some(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1));
  if (!dirty) return false;

  await git.commit({
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
  await git.push({
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
    // Fresh repo — fetch and then checkout the remote HEAD
    await git.fetch({
      fs,
      http,
      dir,
      remote: 'origin',
      ref: BRANCH,
      onAuth: () => ({ username: 'oauth2', password: token }),
    });
    await git.checkout({
      fs,
      dir,
      ref: `refs/remotes/origin/${BRANCH}`,
      force: true,
    });
  } else {
    await git.pull({
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
