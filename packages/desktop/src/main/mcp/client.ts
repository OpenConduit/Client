import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpServerConfig, McpTool, McpToolResult } from '../../shared/types';

interface McpClientEntry {
  client: Client;
  config: McpServerConfig;
  connected: boolean;
}

const clients = new Map<string, McpClientEntry>();

export async function connectMcpServer(config: McpServerConfig): Promise<void> {
  if (clients.has(config.id)) {
    await disconnectMcpServer(config.id);
  }

  const client = new Client({ name: 'openconduit', version: '1.0.0' });

  let transport;
  if (config.transport === 'http-streamable') {
    // Modern MCP: Streamable HTTP (JSON + optional SSE upgrades)
    if (!config.url) throw new Error(`MCP server ${config.name} missing url`);
    const headers = config.headers ?? {};
    transport = new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers } });
  } else if (config.transport === 'http-sse') {
    // Legacy SSE transport
    if (!config.url) throw new Error(`MCP server ${config.name} missing url`);
    const headers = config.headers ?? {};
    transport = new SSEClientTransport(new URL(config.url), { requestInit: { headers } });
  } else {
    if (!config.command) throw new Error(`MCP server ${config.name} missing command`);
    transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: { ...process.env, ...config.env },
    });
  }

  await client.connect(transport);
  clients.set(config.id, { client, config, connected: true });
}

export async function disconnectMcpServer(serverId: string): Promise<void> {
  const entry = clients.get(serverId);
  if (!entry) return;
  try {
    await entry.client.close();
  } catch {
    // best-effort
  }
  clients.delete(serverId);
}

export async function listAllTools(serverIds: string[]): Promise<McpTool[]> {
  const tools: McpTool[] = [];
  for (const id of serverIds) {
    const entry = clients.get(id);
    if (!entry?.connected) continue;
    try {
      const result = await entry.client.listTools();
      for (const t of result.tools) {
        tools.push({
          serverId: id,
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.inputSchema as Record<string, unknown>,
        });
      }
    } catch {
      // server may have disconnected
    }
  }
  return tools;
}

export async function callTool(
  serverId: string,
  toolName: string,
  input: Record<string, unknown>,
): Promise<McpToolResult> {
  const entry = clients.get(serverId);
  if (!entry?.connected) {
    return { toolName, serverId, result: `MCP server ${serverId} not connected`, isError: true };
  }
  try {
    const res = await entry.client.callTool({ name: toolName, arguments: input });
    const isError = res.isError === true;
    const content = res.content as Array<{ type: string; text?: string }> | undefined;
    const result = content
      ?.map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
      .join('\n') ?? '';
    return { toolName, serverId, result, isError };
  } catch (err) {
    return { toolName, serverId, result: String(err), isError: true };
  }
}

export function getMcpStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};
  for (const [id, entry] of clients) {
    status[id] = entry.connected;
  }
  return status;
}
