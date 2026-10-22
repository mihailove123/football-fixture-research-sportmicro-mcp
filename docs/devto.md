I built this project around a simple problem: football fixture data is easy to query in isolation, but hard to expose cleanly to AI clients without turning the integration into a mess of loosely validated endpoints. My goal with this repository was to create a read-only Model Context Protocol server that lets an MCP client ask grounded questions about football fixtures, match details, incidents, and lineups through the Sportmicro API, while keeping the surface area intentionally small.

That shape matters. Instead of trying to mirror the whole API, I focused on a narrow research layer: enough tools to answer fixture questions reliably, but not so many that the server becomes difficult to reason about or trust. The result is a TypeScript MCP server built with `@modelcontextprotocol/sdk`, `zod`, and a typed Sportmicro client.

[View the repository](https://github.com/mihailove123/football-fixture-research-sportmicro-mcp)

## The architecture I used

The implementation is split into three parts:

- `server.ts` defines the MCP tools and validates tool input
- `sportmicro-client.ts` handles HTTP requests to Sportmicro
- `test/server.test.ts` checks validation and error handling without needing a live API call

That separation keeps the MCP layer thin. The server is responsible for turning tool calls into structured responses, but it does not know how to build URLs or authenticate requests. The client owns those HTTP details. That line between “protocol” and “provider integration” is what keeps the code maintainable.

The data flow is straightforward:

1. An MCP client calls one of the registered tools.
2. The server validates the input with `zod`.
3. The Sportmicro client sends the request with the API key as a Bearer token.
4. The server returns structured text so the caller can distinguish success from failure.

A small detail I appreciate here is that the server is intentionally read-only. It does not mutate any Sportmicro data, and it only exposes the documented football endpoints needed for fixture research. That keeps the contract predictable for downstream clients.

## Why a narrow MCP surface works here

I’ve found that MCP servers can grow too quickly if you expose every upstream endpoint just because it exists. This project takes the opposite approach: expose only the tools that match the actual research workflow.

In this repository, that means five tools:

- `search_matches_by_date`
- `search_matches_by_date_and_league`
- `get_match_by_id`
- `get_match_incidents`
- `get_match_lineups`

That small tool set is enough to answer common football research questions without encouraging speculative behavior. It also makes the server easier to validate. For example, `search_matches_by_date` requires a date in `YYYY-MM-DD` format, while `search_matches_by_date_and_league` adds a league ID and optional pagination fields. Inputs are checked before any upstream request is made, which is exactly what I want in a server that sits between an AI client and a third-party API.

The Sportmicro integration itself is equally focused. The client points at the football API and maps each operation to a documented endpoint:

- `/matches-by-date`
- `/matches-by-date-league`
- `/matches`
- `/matches-incidents`
- `/matches-lineups`

That decision matters because it avoids inventing fields or behavior that aren’t present in the provider documentation. When you’re building an AI-facing integration, being precise is more valuable than being broad.

## How the implementation flows

The core implementation lives in `src/server.ts`. I like how compact it is, because the code reveals the actual contract without a lot of framework noise.

A useful pattern here is the `structuredPayload` and `errorPayload` pair. Both return JSON text wrapped in MCP content blocks, which keeps the output machine-readable while still being easy for a client to inspect. The callback wrapper validates input, runs the handler, and converts exceptions into tool-level errors.

Here’s the part that captures that flow:

```ts
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
```

What I like about this approach is that it keeps all the tool-specific plumbing in one place. The actual tool registrations become declarative:

- define an input schema
- connect it to a client method
- register the tool with the MCP server

That pattern is repeated for each tool, so the file stays readable even as the server supports multiple research operations.

The client in `src/sportmicro-client.ts` follows the same principle. It builds a base URL, attaches the API key as `Authorization: Bearer ...`, and converts non-2xx responses into a custom `SportmicroClientError`. That gives the server a clean way to distinguish API failures from validation problems.

## Project structure at a glance

The repository is intentionally small, which helps a lot when you’re working on a protocol adapter rather than a full product.

```text
src/
  index.ts               Entry point export
  server.ts              MCP server and tool registration
  sportmicro-client.ts   Typed Sportmicro HTTP client
  test/                  Node test files
```

The rest of the repository supports that core:

- `README.md` documents setup and usage
- `.env.example` shows the required `SPORTMICRO_API_KEY`
- `package.json` defines the TypeScript build and Node test flow
- `docs/devto.md` contains an article draft for the project

The entry point is also minimal. `src/index.ts` just re-exports `runServer`, and the server starts with stdio transport when executed directly. That is exactly what I want for MCP: a small executable surface, not a lot of bootstrapping code.

## Testing and local setup

The repository supports a simple local workflow:

- Node.js 20 or newer
- `SPORTMICRO_API_KEY` in the environment
- `npm install`
- `npm run build`
- `npm test`
- `node dist/index.js`

Those commands are backed by the project files, so this isn’t speculative setup. The tests use Node’s built-in test runner and are wired to compile before execution through `pretest`, which means the compiled output is what gets tested.

The tests are also practical. They don’t try to hit the live Sportmicro API. Instead, they verify two things the repository can reliably check on its own:

1. malformed tool input is rejected before any client call
2. upstream Sportmicro errors are turned into actionable tool responses

That gives confidence in the contract without depending on network availability or external fixtures.

## Challenges and trade-offs

I’d frame this project more as a set of design constraints than a story of runtime surprises. The code clearly reflects a few trade-offs I had to make:

- **Read-only by design:** useful for research, but it means the server is intentionally limited in scope.
- **Small tool surface:** easier to trust and test, but it does not attempt to cover the full Sportmicro API.
- **Structured JSON text responses:** simple for MCP clients to parse, though not as rich as a custom resource model.
- **Environment-based API key handling:** secure and portable, but it requires setup before the server can run.

There’s also a subtle constraint in the client implementation: it only sends query parameters when values are present. That keeps requests tidy, but it also means the server’s schemas need to stay aligned with what the API expects. In a narrow integration like this, that’s a good trade-off because it forces clarity instead of hidden behavior.

## What I’d improve next

A few next steps stand out as sensible future improvements:

- add richer match-detail tools where the Sportmicro documentation supports them
- include more explicit freshness metadata in tool responses
- add a small integration-test harness that mocks Sportmicro responses
- make the output shape even more descriptive for clients that want to inspect match data programmatically

I’d keep those improvements aligned with the same principle as the current implementation: only add what can be documented, validated, and supported cleanly.

## Takeaway

What I like most about this project is that it treats an MCP server as an integration boundary, not a feature dump. The server is small on purpose, the validation is explicit, and the Sportmicro client owns the API details cleanly. That makes the code easier to trust, easier to test, and easier to extend without breaking the contract.

If you’re building a TypeScript MCP server for an external API, this is the pattern I’d recommend: keep the tool surface narrow, validate early, return structured errors, and let the provider client handle the HTTP mechanics. For a read-only football fixture research server, that combination is enough to stay focused while still being useful.
