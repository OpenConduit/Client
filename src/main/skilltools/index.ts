/**
 * Built-in skill tool handler for the main process.
 *
 * When the AI calls `skill_list`, `skill_read`, or `skill_save`, ipc.ts routes
 * the tool call here. Results are returned in McpToolResult shape so the rest
 * of the pipeline is unchanged.
 *
 * Tools:
 *  • skill_list  — list all available skills (name, description, autoApply)
 *  • skill_read  — fetch the full SKILL.md content for a named skill
 *  • skill_save  — write a new skill to the user's default workspace (~/.openconduit)
 */

import type { ToolCall, McpTool, McpToolResult, SkillWorkspace } from '../../shared/types';
import { listSkills, writeSkill, getUserSkillsPath } from '../skills';

/** The serverId used for all built-in skill tool calls. */
export const SKILLS_SERVER_ID = '__skilltools__';

/** Names of all tools handled by this module. */
export const SKILL_TOOL_NAMES = ['skill_list', 'skill_read', 'skill_save'] as const;
export type SkillToolName = (typeof SKILL_TOOL_NAMES)[number];

// ─── Tool definitions (JSON schema) ──────────────────────────────────────────

export const SKILL_TOOL_DEFS: McpTool[] = [
  {
    serverId: SKILLS_SERVER_ID,
    name: 'skill_list',
    description:
      'List all Copilot skills available in this workspace. Returns name, description, and whether the skill is set to auto-apply.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    serverId: SKILLS_SERVER_ID,
    name: 'skill_read',
    description:
      'Read the full content of a Copilot skill by name. Use skill_list first to discover available skills.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The skill name as returned by skill_list (case-insensitive).',
        },
      },
      required: ['name'],
    },
  },
  {
    serverId: SKILLS_SERVER_ID,
    name: 'skill_save',
    description:
      'Save a new Copilot skill to the user\'s default skill directory (~/.openconduit/skills). The content should be a valid SKILL.md file with YAML frontmatter (name, description, autoApply).',
    inputSchema: {
      type: 'object',
      properties: {
        folderName: {
          type: 'string',
          description:
            'Folder name for the skill directory, e.g. "add-provider". Use lowercase-kebab-case.',
        },
        content: {
          type: 'string',
          description:
            'Full SKILL.md content including YAML frontmatter block (--- delimited) with at minimum `name` and `description` fields.',
        },
      },
      required: ['folderName', 'content'],
    },
  },
];

// ─── Implementations ──────────────────────────────────────────────────────────

async function runSkillList(workspaces: SkillWorkspace[]): Promise<string> {
  const skills = await listSkills(workspaces);
  if (skills.length === 0) {
    return 'No skills found. Use skill_save to create one.';
  }
  const rows = skills.map((s) =>
    `• ${s.name}${s.autoApply ? ' [auto-apply]' : ''}${s.description ? ` — ${s.description}` : ''}`,
  );
  return rows.join('\n');
}

async function runSkillRead(
  input: Record<string, unknown>,
  workspaces: SkillWorkspace[],
): Promise<string> {
  const query = (input.name as string | undefined)?.trim();
  if (!query) throw new Error('skill_read: name is required');

  const skills = await listSkills(workspaces);
  const lower = query.toLowerCase();
  const match =
    skills.find((s) => s.name.toLowerCase() === lower) ??
    skills.find((s) => s.folderPath.split('/').pop()?.toLowerCase() === lower) ??
    skills.find((s) => s.name.toLowerCase().includes(lower));

  if (!match) {
    const available = skills.map((s) => s.name).join(', ');
    throw new Error(
      `Skill "${query}" not found. Available skills: ${available || 'none'}`,
    );
  }
  return match.content;
}

async function runSkillSave(input: Record<string, unknown>): Promise<string> {
  const folderName = (input.folderName as string | undefined)?.trim();
  const content = input.content as string | undefined;

  if (!folderName) throw new Error('skill_save: folderName is required');
  if (!content) throw new Error('skill_save: content is required');

  // Validate folderName — lowercase letters, digits, and hyphens only
  if (!/^[a-z0-9-]+$/.test(folderName)) {
    throw new Error(
      'skill_save: folderName must be lowercase-kebab-case (letters, digits, hyphens only)',
    );
  }

  await writeSkill({
    workspacePath: getUserSkillsPath(),
    folderName,
    content,
  });

  return `Skill "${folderName}" saved to ${getUserSkillsPath()}/.openconduit/skills/${folderName}/SKILL.md`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function callSkillTool(
  tc: ToolCall,
  workspaces: SkillWorkspace[],
): Promise<McpToolResult> {
  try {
    let result: string;
    switch (tc.name as SkillToolName) {
      case 'skill_list':
        result = await runSkillList(workspaces);
        break;
      case 'skill_read':
        result = await runSkillRead(tc.input, workspaces);
        break;
      case 'skill_save':
        result = await runSkillSave(tc.input);
        break;
      default:
        return { toolName: tc.name, serverId: '__skill__', result: `Unknown skill tool: ${tc.name}`, isError: true };
    }
    return { toolName: tc.name, serverId: '__skill__', result, isError: false };
  } catch (err) {
    return { toolName: tc.name, serverId: '__skill__', result: (err as Error).message, isError: true };
  }
}
