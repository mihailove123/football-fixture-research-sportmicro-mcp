import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SportmicroClient, SportmicroClientError } from './sportmicro-client.js';

const idSchema = z.string().trim().min(1).max(128);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format');
const positiveIntegerString = z.string().regex(/^\d+$/).refine((value) => Number(value) > 0, 'Expected a positive integer');

type ToolResponse = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

type ToolSpec = { inputSchema: Record<string, z.ZodTypeAny>; handler: (input: any) => Promise<unknown> };

type RegisteredTool = { callback: (input: unknown) => Promise<ToolResponse> };

function structuredPayload(tool: string, data: unknown): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify({ tool, data }, null, 2) }] };
}

function errorPayload(tool: string, message: string): ToolResponse {
  return { content: [{ type: 'text', text: JSON.stringify({ tool, error: message }, null, 2) }], isError: true };
}

function buildToolCallback(name: string, spec: ToolSpec) {
  return async (input: unknown) => {
    const parsed = z.object(spec.inputSchema).parse(input);
    try {
      const data = await spec.handler(parsed);
      return structuredPayload(name, data);
    } catch (error) {
      return errorResponse(name, error);
    }
  };
}

function registerTool(server: any, name: string, spec: ToolSpec) {
  const callback = buildToolCallback(name, spec);
  server.tool(name, spec.inputSchema, callback);
  const tools = server._registeredTools as Record<string, RegisteredTool> | undefined;
  if (tools) {
    tools[name] = { callback };
  }
}

export function createServer(client: SportmicroClient = new SportmicroClient()) {
  const server = new McpServer({ name: 'football-fixture-research-sportmicro-mcp', version: '1.0.0' });

  registerTool(server, 'search_matches_by_date', {
    inputSchema: { date: dateSchema, limit: positiveIntegerString.optional(), offset: positiveIntegerString.optional() },
    handler: async (input) => client.getMatchesByDate(input.date, input.limit, input.offset)
  });

  registerTool(server, 'search_matches_by_date_and_league', {
    inputSchema: { date: dateSchema, leagueId: idSchema, limit: positiveIntegerString.optional(), offset: positiveIntegerString.optional() },
    handler: async (input) => client.getMatchesByDateLeague(input.date, input.leagueId, input.limit, input.offset)
  });

  registerTool(server, 'get_match_by_id', {
    inputSchema: { matchId: idSchema },
    handler: async (input) => client.getMatches({ id: input.matchId })
  });

  registerTool(server, 'get_match_incidents', {
    inputSchema: { matchId: idSchema },
    handler: async (input) => client.getMatchesIncidents(input.matchId)
  });

  registerTool(server, 'get_match_lineups', {
    inputSchema: { matchId: idSchema },
    handler: async (input) => client.getMatchesLineups(input.matchId)
  });

  return server;
}

function errorResponse(tool: string, error: unknown): ToolResponse {
  if (error instanceof SportmicroClientError) {
    return errorPayload(tool, error.message);
  }
  if (error instanceof z.ZodError) {
    return errorPayload(tool, error.issues[0]?.message ?? 'Invalid tool input');
  }
  return errorPayload(tool, 'Unexpected error while contacting Sportmicro');
}

export async function runServer() {
  const transport = new StdioServerTransport();
  const server = createServer();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void runServer();
}
