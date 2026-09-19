import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';
import { SportmicroClientError } from '../sportmicro-client.js';

class FakeClient {
  calls: Array<{ name: string; args: unknown[] }> = [];
  async getMatchesByDate(date: string) { this.calls.push({ name: 'getMatchesByDate', args: [date] }); return [{ id: 1, date }]; }
  async getMatchesByDateLeague(date: string, leagueId: string) { this.calls.push({ name: 'getMatchesByDateLeague', args: [date, leagueId] }); return [{ id: 2, date, leagueId }]; }
  async getMatches(filter: { id?: string }) { this.calls.push({ name: 'getMatches', args: [filter] }); return [{ id: 3 }]; }
  async getMatchesIncidents(matchId: string) { this.calls.push({ name: 'getMatchesIncidents', args: [matchId] }); return [{ matchId, incident: 'goal' }]; }
  async getMatchesLineups(matchId: string) { this.calls.push({ name: 'getMatchesLineups', args: [matchId] }); return [{ matchId, confirmed: true }]; }
}

function toolHandler(server: unknown, name: string) {
  const tool = (server as { _registeredTools?: Record<string, unknown> })._registeredTools?.[name] as { callback?: (args: unknown) => Promise<unknown> } | undefined;
  assert.ok(tool?.callback, `expected ${name} tool`);
  return tool.callback!;
}

test('validates date input before calling Sportmicro', async () => {
  const client = new FakeClient();
  const server = createServer(client as never);
  await assert.rejects(() => toolHandler(server, 'search_matches_by_date')({ date: '2024-1-1' }), /Expected date in YYYY-MM-DD format/);
  assert.equal(client.calls.length, 0);
});

test('maps upstream errors into actionable tool errors', async () => {
  const client = new FakeClient();
  client.getMatchesIncidents = async () => { throw new SportmicroClientError('Sportmicro request failed with status 403', 403); };
  const server = createServer(client as never);
  const result = await toolHandler(server, 'get_match_incidents')({ matchId: '123' });
  assert.match(String((result as { content: Array<{ text: string }> }).content[0]!.text), /Sportmicro request failed with status 403/);
  assert.equal((result as { isError?: boolean }).isError, true);
});
