# amazon-seller-mcp

A Model Context Protocol (MCP) server over the Amazon Selling Partner API (SP-API).
Phase 0 is a local, single-tenant stdio server for one seller account, used to
prove the SP-API integration before the hosted multi-tenant work.

See the design spec: `docs/superpowers/specs/2026-06-16-amazon-spapi-mcp-server-design.md`

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your LWA credentials and refresh token
   (from self-authorizing a draft SP-API app against your seller account).
3. Keep `SPAPI_SANDBOX=true` until you have verified behavior against the sandbox.

## Commands

- `npm test` runs the unit test suite (no credentials needed; uses mocked fetch).
- `npm run typecheck` type-checks the project.
- `npm run dev` runs the stdio MCP server from source.
- `npm run build` bundles to `dist/`.

## Manual validation checklist

1. With `.env` populated and `SPAPI_SANDBOX=true`, run `npm run dev`.
2. Connect an MCP client to the stdio command `npm run dev` (or `node dist/index.js`
   after `npm run build`). For Claude Desktop, add an entry under `mcpServers`
   pointing `command` to `node` and `args` to the built `dist/index.js`, with the
   `.env` values supplied as `env`.
3. Call the `connection_status` tool. Expected: JSON echoing your region, sandbox
   flag, and marketplace IDs.
4. Call the `sellers_get_marketplaces` tool. Expected: a JSON array of marketplace
   participations from the sandbox.
5. Switch `SPAPI_SANDBOX=false` and repeat step 4 against your real seller account.
   Expected: your actual marketplace participation(s).
