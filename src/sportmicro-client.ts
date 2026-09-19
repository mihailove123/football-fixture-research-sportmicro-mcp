const BASE_URL = 'https://football.sportmicro.com';

export class SportmicroClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'SportmicroClientError';
  }
}

type Query = Record<string, string | undefined>;

export class SportmicroClient {
  constructor(private readonly apiKey = process.env.SPORTMICRO_API_KEY, private readonly fetchImpl: typeof fetch = fetch) {}

  private async request(path: string, query: Query): Promise<unknown> {
    if (!this.apiKey) {
      throw new SportmicroClientError('SPORTMICRO_API_KEY is required');
    }

    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      throw new SportmicroClientError(`Sportmicro request failed with status ${response.status}`, response.status);
    }

    return response.json() as Promise<unknown>;
  }

  getMatchesByDate(date: string, limit?: string, offset?: string) {
    return this.request('/matches-by-date', { date: `eq.${date}`, limit, offset });
  }

  getMatchesByDateLeague(date: string, leagueId: string, limit?: string, offset?: string) {
    return this.request('/matches-by-date-league', { date: `eq.${date}`, league_id: `eq.${leagueId}`, limit, offset });
  }

  getMatches(filter: { id?: string }) {
    return this.request('/matches', { id: filter.id });
  }

  getMatchesIncidents(matchId: string) {
    return this.request('/matches-incidents', { match_id: `eq.${matchId}` });
  }

  getMatchesLineups(matchId: string) {
    return this.request('/matches-lineups', { id: `eq.${matchId}` });
  }
}
