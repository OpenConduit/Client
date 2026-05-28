/**
 * Built-in file tool handler for the main process.
 *
 * When the AI calls `file_read`, `file_write`, `file_delete`, or `file_list`,
 * ipc.ts routes the tool call here. All operations are sandboxed to the
 * user-picked folder (rootPath) — path traversal is rejected.
 *
 * Results are returned in McpToolResult shape so the pipeline is unchanged.
 */

import fs from 'fs/promises';
import path from 'path';
import type { ToolCall, McpTool, McpToolResult } from '../../shared/types';

/** The serverId used for all built-in file tool calls. */
export const FILE_SERVER_ID = '__filetools__';

/** Names of all tools handled by this module. */
export const FILE_TOOL_NAMES = ['file_read', 'file_write', 'file_delete', 'file_list'] as const;
export type FileToolName = (typeof FILE_TOOL_NAMES)[number];

// ─── Tool definitions (JSON schema) ──────────────────────────────────────────

export const FILE_TOOL_DEFS: McpTool[] = [
  {
    serverId: FILE_SERVER_ID,
    name: 'file_read',
    description: 'Read the contents of a file inside the attached folder.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path relative to the folder root, e.g. "src/index.ts"',
        },
      },
      required: ['path'],
    },
  },
  {
    serverId: FILE_SERVER_ID,
    name: 'file_write',
    description: 'Create or overwrite a file inside the attached folder.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path relative to the folder root, e.g. "src/utils.ts"',
        },
        content: {
          type: 'string',
          description: 'Full text content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    serverId: FILE_SERVER_ID,
    name: 'file_delete',
    description: 'Delete a file or directory inside the attached folder.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path relative to the folder root',
        },
      },
      required: ['path'],
    },
  },
  {
    serverId: FILE_SERVER_ID,
    name: 'file_list',
    description: 'List files and directories inside the attached folder at a given path.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path relative to the folder root. Use "" or "." for the root.',
        },
      },
      required: [],
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolves and validates that the target is strictly inside rootPath. */
function safeResolve(rootPath: string, relativePath: string): string {
  const base = path.resolve(rootPath);
  const target = path.resolve(rootPath, relativePath);
  if (!target.startsWith(base + path.sep) && target !== base) {
    throw new Error(`Access denied: "${relativePath}" is outside the attached folder`);
  }
  return target;
}

// ─── Implementations ──────────────────────────────────────────────────────────

async function runFileRead(input: Record<string, unknown>, rootPath: string): Promise<string> {
  const rel = input.path as string;
  if (!rel) throw new Error('file_read: path is required');
  const target = safeResolve(rootPath, rel);
  const content = await fs.readFile(target, 'utf-8');
  return content;
}

async function runFileWrite(input: Record<string, unknown>, rootPath: string): Promise<string> {
  const rel = input.path as string;
  const content = input.content as string;
  if (!rel) throw new Error('file_write: path is required');
  if (content === undefined || content === null) throw new Error('file_write: content is required');
  const target = safeResolve(rootPath, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
  return `Written ${content.length} chars to ${rel}`;
}

async function runFileDelete(input: Record<string, unknown>, rootPath: string): Promise<string> {
  const rel = input.path as string;
  if (!rel) throw new Error('file_delete: path is required');
  const target = safeResolve(rootPath, rel);
  await fs.rm(target, { recursive: true, force: true });
  return `Deleted ${rel}`;
}

async function runFileList(input: Record<string, unknown>, rootPath: string): Promise<string> {
  const rel = (input.path as string | undefined) ?? '';
  const target = rel ? safeResolve(rootPath, rel) : path.resolve(rootPath);
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(target, { withFileTypes: true });
  } catch {
    throw new Error(`file_list: cannot read directory "${rel || '.'}"`);
  }
  const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  return lines.join('\n');
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Execute a built-in file tool call and return the result in McpToolResult
 * format so the ipc.ts pipeline can treat it identically to MCP results.
 */
export async function callFileTool(
  tc: ToolCall,
  rootPath: string,
): Promise<McpToolResult> {
  try {
    let result: string;
    switch (tc.name) {
      case 'file_read':   result = await runFileRead(tc.input, rootPath);   break;
      case 'file_write':  result = await runFileWrite(tc.input, rootPath);  break;
      case 'file_delete': result = await runFileDelete(tc.input, rootPath); break;
      case 'file_list':   result = await runFileList(tc.input, rootPath);   break;
      default: throw new Error(`Unknown file tool: ${tc.name}`);
    }
    return { toolName: tc.name, serverId: FILE_SERVER_ID, result, isError: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { toolName: tc.name, serverId: FILE_SERVER_ID, result: msg, isError: true };
  }
}
