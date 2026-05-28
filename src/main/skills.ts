/**
 * skills.ts — Main-process Copilot skill manager
 *
 * Reads and writes `.github/skills/<name>/SKILL.md` (and optional reference
 * files) inside user-configured workspace roots.  The renderer cannot touch
 * the filesystem directly (contextIsolation: true) so all operations go
 * through IPC.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'node:path';
import type { SkillFile, SkillWorkspace, SkillWritePayload } from '../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Primary write location for skills created by OpenConduit.
 * Kept separate from .github/ so it isn't confused with Copilot workspace customisations.
 */
const SKILL_WRITE_SUB_PATH = path.join('.openconduit', 'skills');

/**
 * Default user-level workspace — ~/.openconduit.
 * Always included when listing/writing skills so there's a writable location
 * even when no project workspaces are configured.
 */
const USER_SKILLS_WORKSPACE: SkillWorkspace = {
  path: path.join(os.homedir(), '.openconduit'),
  label: '~ (default)',
};

/** Returns the default per-user skills root path (~/.openconduit). */
export function getUserSkillsPath(): string {
  return USER_SKILLS_WORKSPACE.path;
}

/**
 * All locations scanned when listing skills.
 * .openconduit/skills/ is first so OpenConduit-authored skills sort before imported ones.
 */
const SKILL_SCAN_PATHS = [
  path.join('.openconduit', 'skills'),
  path.join('.github', 'skills'),
  path.join('.agents', 'skills'),
  path.join('.claude', 'skills'),
];

/**
 * Extract the `name` and `description` from a SKILL.md frontmatter block.
 * Frontmatter is delimited by `---` lines at the top of the file.
 */
function parseFrontmatter(content: string): { name?: string; description?: string; autoApply?: boolean } {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return {};

  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end === -1) return {};

  const fm: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    // Strip surrounding quotes from the value
    const raw = line.slice(colon + 1).trim();
    fm[key] = raw.replace(/^['"]|['"]$/g, '');
  }
  return {
    name: fm['name'],
    description: fm['description'],
    autoApply: fm['autoApply'] === 'true',
  };
}

/** Recursively collect all files under `dir`, returning paths relative to `dir`. */
async function collectFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = await fs.stat(full).catch((): null => null);
    if (!stat) continue;
    if (stat.isDirectory()) {
      const sub = await collectFiles(full);
      results.push(...sub.map((s) => path.join(entry, s)));
    } else {
      results.push(entry);
    }
  }
  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List all skills found in every configured workspace.
 * Scans `.github/skills/`, `.agents/skills/`, and `.claude/skills/` in each workspace.
 */
export async function listSkills(workspaces: SkillWorkspace[]): Promise<SkillFile[]> {
  const results: SkillFile[] = [];

  // Always include the user-level workspace; prepend it so it sorts first.
  const allWorkspaces: SkillWorkspace[] = [
    USER_SKILLS_WORKSPACE,
    ...workspaces.filter((w) => w.path !== USER_SKILLS_WORKSPACE.path),
  ];

  for (const ws of allWorkspaces) {
    for (const subPath of SKILL_SCAN_PATHS) {
      const skillsRoot = path.join(ws.path, subPath);
      let skillDirs: string[] = [];
      try {
        skillDirs = await fs.readdir(skillsRoot);
      } catch {
        continue; // directory doesn't exist — skip
      }

      for (const skillDir of skillDirs) {
        const skillFolderPath = path.join(skillsRoot, skillDir);
        const stat = await fs.stat(skillFolderPath).catch((): null => null);
        if (!stat?.isDirectory()) continue;

        const skillMdPath = path.join(skillFolderPath, 'SKILL.md');
        let content = '';
        try {
          content = await fs.readFile(skillMdPath, 'utf-8');
        } catch {
          continue; // no SKILL.md — skip
        }

        const { name, description, autoApply } = parseFrontmatter(content);

        // Collect reference files (everything except SKILL.md)
        const allFiles = await collectFiles(skillFolderPath);
        const referenceFiles: Record<string, string> = {};
        for (const relPath of allFiles) {
          if (relPath === 'SKILL.md') continue;
          try {
            referenceFiles[relPath] = await fs.readFile(
              path.join(skillFolderPath, relPath),
              'utf-8',
            );
          } catch {
            // binary or unreadable — skip
          }
        }

        results.push({
          name: name ?? skillDir,
          description: description ?? '',
          folderPath: skillFolderPath,
          content,
          workspacePath: ws.path,
          referenceFiles,
          autoApply: autoApply ?? false,
        });
      }
    }
  }

  return results;
}

/**
 * Write (create or overwrite) a skill into a workspace.
 * Always writes to `.github/skills/<folderName>/`.
 */
export async function writeSkill(payload: SkillWritePayload): Promise<void> {
  const { workspacePath, folderName, content, referenceFiles = {} } = payload;

  // Validate folderName — only lowercase alphanumeric + hyphens
  if (!/^[a-z0-9-]+$/.test(folderName)) {
    throw new Error(`Invalid skill folder name: "${folderName}". Use lowercase alphanumeric characters and hyphens only.`);
  }

  const skillDir = path.join(workspacePath, SKILL_WRITE_SUB_PATH, folderName);
  await fs.mkdir(skillDir, { recursive: true });

  // Write SKILL.md
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');

  // Write reference files
  for (const [relPath, fileContent] of Object.entries(referenceFiles)) {
    // Prevent path traversal
    const resolved = path.resolve(skillDir, relPath);
    if (!resolved.startsWith(path.resolve(skillDir))) {
      throw new Error(`Refusing to write outside skill directory: ${relPath}`);
    }
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, fileContent, 'utf-8');
  }
}

/**
 * Delete a skill folder by its absolute `folderPath`.
 * Refuses to delete anything outside a configured workspace's skill directories.
 */
export async function deleteSkill(
  folderPath: string,
  workspaces: SkillWorkspace[],
): Promise<void> {
  const normalised = path.resolve(folderPath);

  // Safety: confirm the path is inside a known workspace's skill directory.
  // The user-level workspace (~/.openconduit) is always an allowed root.
  const allWorkspaces = [USER_SKILLS_WORKSPACE, ...workspaces];
  const allowed = allWorkspaces.some((ws) =>
    SKILL_SCAN_PATHS.some((sub) =>
      normalised.startsWith(path.resolve(path.join(ws.path, sub))),
    ),
  );

  if (!allowed) {
    throw new Error(`Refusing to delete path outside a configured skill directory: ${folderPath}`);
  }

  await fs.rm(normalised, { recursive: true, force: true });
}
