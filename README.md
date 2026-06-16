# amazon-seller-mcp

A Model Context Protocol (MCP) server over the Amazon Selling Partner API (SP-API).

The server ships in two modes:

| Mode | Entry point | Use case |
|---|---|---|
| **stdio (single-tenant)** | `dist/index.js` | Local dev; one seller account configured via `.env` |
| **HTTP (multi-tenant)** | `dist/httpServer.js` | Hosted service; many sellers, each authorized via OAuth |

See the design spec: `docs/superpowers/specs/2026-06-16-amazon-spapi-mcp-server-design.md`
See the deployment guide: `docs/DEPLOY.md`

---

## stdio Mode (Single-Tenant)

Connect an MCP client directly to the process over stdin/stdout. No HTTP, no OAuth
infrastructure needed. One seller account configured entirely from environment variables.

### Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your LWA credentials and refresh token
   (from self-authorizing a draft SP-API app against your seller account).
3. Keep `SPAPI_SANDBOX=true` until you have verified behavior against the sandbox.

### Commands

```
npm run dev          # Run stdio server from source (tsx)
npm run build        # Compile to dist/
node dist/index.js   # Run compiled stdio server
```

### Connecting a Client

For Claude Desktop, add an entry under `mcpServers`:
```json
{
  "mcpServers": {
    "amazon-seller": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "LWA_CLIENT_ID": "...",
        "LWA_CLIENT_SECRET": "...",
        "SPAPI_REFRESH_TOKEN": "...",
        "SPAPI_REGION": "na",
        "SPAPI_SANDBOX": "true"
      }
    }
  }
}
```

---

## HTTP Mode (Multi-Tenant)

A hosted Express server that serves many sellers over a single deployment. Each
incoming MCP request carries a bearer token; the server validates it and resolves
the corresponding seller connection from the vault.

### Two OAuth Legs

**Leg 1: MCP client -> our server (Resource Server)**
- Our server is an OAuth 2.1 Resource Server.
- Every `/mcp` request must include `Authorization: Bearer <token>`.
- The token must be audience-bound to `<PUBLIC_URL>/mcp`.
- Your Authorization Server (Auth0, WorkOS, Stytch, etc.) issues these tokens.
- RFC 9728 Protected Resource Metadata is served at
  `GET /.well-known/oauth-protected-resource` so clients can discover the auth server.

**Leg 2: our server -> Amazon LWA (OAuth Client)**
- A seller authorizes once via `GET /connect` (requires a valid Leg 1 token).
- Our server generates a single-use state token, then redirects to the LWA consent page.
- Amazon redirects back to `GET /callback` with `spapi_oauth_code`.
- Our server exchanges the code for a refresh token and stores it encrypted in the vault.
- The inbound MCP bearer token is NEVER forwarded to Amazon.

### Quick Start (Dev Mode)

```bash
# Generate a random vault key
export SPAPI_VAULT_KEY=$(openssl rand -base64 32)
export AUTH_MODE=dev
export DEV_JWT_SECRET=dev-secret
export PUBLIC_URL=http://localhost:3000
export AUTH_SERVER_URL=http://localhost:3000
export SPAPI_APP_ID=amzn1.sellerapps.app.dev
export LWA_CLIENT_ID=amzn1.application-oa2-client.dev
export LWA_CLIENT_SECRET=dev-secret
export VAULT_BACKEND=memory
export DEV_SEED_USER_ID=test-user
export DEV_SEED_REFRESH_TOKEN=Atzr|dev-token

npm run dev:http
```

### Connecting a Client

Point your MCP client at `https://<PUBLIC_URL>/mcp` with `Authorization: Bearer <token>`.
See `docs/DEPLOY.md` for full deployment and AWS resource documentation.

---

## Available Tools (~37 total)

| Group | Tools |
|---|---|
| Account | `connection_status`, `sellers_get_marketplaces` |
| Catalog | catalog search and item lookup |
| Listings | create, patch, delete listings |
| Product Types | schema definitions |
| FBA Inventory | inventory summaries |
| Pricing | competitive pricing, offers |
| Fees | estimate fees |
| Reports | request, list, get report documents |
| Feeds | submit, list, get feed results |
| Finances | financial events |
| Sales | order metrics, traffic |
| Notifications | manage destinations and subscriptions |
| Orders | list and get orders |
| Merchant Fulfillment | shipment rates and labels |
| Messaging | buyer-seller messaging |
| Solicitations | review request actions |
| Alerts | `recent_alerts` (SP-API events from SQS) |

---

## Development Commands

```
npm test             # Unit tests (no credentials needed)
npm run typecheck    # TypeScript type check
npm run dev          # stdio server from source
npm run dev:http     # HTTP server from source
npm run build        # Compile both entry points to dist/
```
