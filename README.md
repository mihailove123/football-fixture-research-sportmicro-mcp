# Football Fixture Research MCP Server with Sportmicro API

A focused read-only **football fixtures MCP server** for AI clients that need grounded fixture research from [Sportmicro](https://sportmicro.com). The server uses the official `@modelcontextprotocol/sdk` over stdio and exposes a small set of narrowly scoped tools for date-based fixture lookups, match lookup by ID, and documented match-detail endpoints.

This repository is intentionally limited to endpoints documented in the supplied Sportmicro football OpenAPI reference: [https://docs.sportmicro.com/](https://docs.sportmicro.com/).

## Features

- Narrow fixture-research MCP tools
- Date and supported-filter input schemas
- Event detail lookups when documented
- Structured tool responses
- Actionable API error messages
- Read-only operation

## What this server can do

Implemented tools:

- `search_matches_by_date`
- `search_matches_by_date_and_league`
- `get_match_by_id`
- `get_match_incidents`
- `get_match_lineups`

Each tool validates its inputs before the Sportmicro request is made. Responses are returned as structured JSON text so clients can inspect the result shape or upstream failure details.

## Prerequisites

- Node.js 20 or newer
- A Sportmicro API key in `SPORTMICRO_API_KEY`

## Installation

```bash
npm install
```

## Environment variables

Copy `.env.example` to `.env` and provide your key:

```bash
cp .env.example .env
```

```env
SPORTMICRO_API_KEY=your_api_key_here
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Run

After building, start the MCP server with stdio transport:

```bash
node dist/index.js
```

## API usage

The server calls only documented Sportmicro football endpoints, including:

- `GET /matches-by-date`
- `GET /matches-by-date-league`
- `GET /matches`
- `GET /matches-incidents`
- `GET /matches-lineups`

Example request flow inside the server:

```ts
const data = await client.getMatchesByDate('2024-05-01');
```

The client sends the API key as a Bearer token and maps non-2xx responses to an actionable tool error.

## Code example

```ts
import { SportmicroClient } from './sportmicro-client.js';

const client = new SportmicroClient(process.env.SPORTMICRO_API_KEY);
const matches = await client.getMatchesByDate('2024-05-01');
```

## Project structure

```text
src/
  index.ts               Entry point export
  server.ts              MCP server and tool registration
  sportmicro-client.ts   Typed Sportmicro HTTP client
  test/                  Node test files
```

## Known limitations

- The server is read-only by design.
- It only exposes a small subset of documented Sportmicro football endpoints.
- Tool responses are structured JSON text rather than custom MCP resources.
- It does not invent fields or endpoints that are not present in the Sportmicro documentation.

## License

MIT
