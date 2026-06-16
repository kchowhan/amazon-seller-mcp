# Wave 4: Multi-Tenant + Hosting

> Transform the single-tenant stdio server into a hosted, multi-tenant remote MCP server, WITHOUT breaking the existing stdio mode or the 234 passing tests. Build clean interfaces with working in-memory implementations (runnable + tested) plus AWS-ready adapters (type-checked) and a Dockerfile. Ground the MCP HTTP transport + auth in the installed `@modelcontextprotocol/sdk` types and the MCP authorization spec.

**Architecture recap (two OAuth legs):**
- Leg 1 (MCP client -> our server): our server is an OAuth 2.1 Resource Server. Validate inbound bearer tokens, audience-bound to our server URI. Serve Protected Resource Metadata (RFC 9728).
- Leg 2 (our server -> Amazon LWA): our server is an OAuth client to LWA. A seller authorizes once (/connect -> LWA consent -> /callback), we exchange `spapi_oauth_code` for a refresh token and store it encrypted in a per-seller vault keyed to the MCP user identity (the `sub` from Leg 1). NEVER forward the inbound MCP token to Amazon.

**New dependencies:** `express`, `@types/express`, `jose` (JWT verify), `@aws-sdk/client-dynamodb`, `@aws-sdk/client-kms`, `@aws-sdk/client-sqs` (adapters).

---

## Task 1: Vault + consent types and interfaces

`src/vault/types.ts`:
```ts
export interface SellerConnection {
  mcpUserId: string;          // stable identity from Leg 1 (the OAuth `sub`)
  sellingPartnerId?: string;
  marketplaceIds: string[];
  refreshToken: string;       // plaintext in memory; encrypted at rest by the vault impl
  grantedRoles?: string[];
  createdAt: number;
  updatedAt: number;
}
export interface TokenVault {
  getConnection(mcpUserId: string): Promise<SellerConnection | undefined>;
  storeConnection(conn: SellerConnection): Promise<void>;
  revokeConnection(mcpUserId: string): Promise<void>;
  listConnections(): Promise<SellerConnection[]>;
}
export interface Encryptor {
  encrypt(plaintext: string): Promise<string>;  // opaque base64 blob
  decrypt(ciphertext: string): Promise<string>;
}
export interface ConsentRecord {
  mcpUserId: string; clientId: string; redirectUri: string; scopes: string[]; grantedAt: number;
}
export interface ConsentStore {
  isApproved(mcpUserId: string, clientId: string, redirectUri: string): Promise<boolean>;
  approve(record: ConsentRecord): Promise<void>;
}
```
- [ ] Create the file. No test needed (types only). Commit.

## Task 2: Local AES-256-GCM encryptor

`src/vault/localEncryptor.ts`: implement `Encryptor` with `node:crypto` AES-256-GCM. Key from a 32-byte base64 in the constructor (caller reads `SPAPI_VAULT_KEY` env). Ciphertext blob = base64(`iv(12) || authTag(16) || ciphertext`). `decrypt` reverses it.
- [ ] TDD: round-trips a string; different ciphertext each call (random IV); tampered blob throws on decrypt. Commit.

## Task 3: In-memory vault + consent store

`src/vault/inMemoryVault.ts`: `InMemoryTokenVault implements TokenVault` storing records in a Map, with the `refreshToken` encrypted at rest via an injected `Encryptor` (encrypt on store, decrypt on get). `InMemoryConsentStore implements ConsentStore` (Map keyed by `mcpUserId|clientId|redirectUri`).
- [ ] TDD: store/get round-trips and the stored value is encrypted (the raw map entry is not the plaintext token); revoke removes; consent approve/isApproved. Commit.

## Task 4: Per-seller client factory

`src/sellerClient.ts`: `SellerClientFactory` that, given an `mcpUserId`, resolves the `SellerConnection` from the vault, builds an `LwaTokenClient` (using that connection's `refreshToken` + the app's `clientId`/`clientSecret` + the LWA token URL) and an `SpApiClient` (with the resolved `Endpoints`), caching one `SpApiClient` per `mcpUserId`. Throws a clear error if no connection exists ("seller not connected; complete /connect first").
```ts
export class SellerClientFactory {
  constructor(
    private vault: TokenVault,
    private endpoints: Endpoints,
    private appCreds: { clientId: string; clientSecret: string },
  ) {}
  async forUser(mcpUserId: string): Promise<{ client: SpApiClient; connection: SellerConnection }> { ... }
}
```
- [ ] TDD with an in-memory vault seeded with a connection: returns a working client; caches (second call same instance); throws when not connected. Commit.

## Task 5: AWS adapters (type-checked; no live AWS in tests)

Add deps. Implement:
- `src/vault/kmsEncryptor.ts`: `Encryptor` using `@aws-sdk/client-kms` (Encrypt/Decrypt with a configured KeyId; ciphertext base64). 
- `src/vault/dynamoVault.ts`: `TokenVault` using `@aws-sdk/client-dynamodb` (DynamoDB table keyed by `mcpUserId`; store the encrypted refreshToken via an injected `Encryptor`).
These are AWS-ready and must typecheck; do not add unit tests that require AWS. Add a brief comment on required IAM + table schema.
- [ ] Implement, `npm run typecheck` clean. Commit.

## Task 6: Auth verifier (Leg 1)

`src/auth/verifier.ts`:
```ts
export interface AuthInfo { sub: string; scopes: string[]; }
export interface AuthVerifier { verify(bearerToken: string, resourceUri: string): Promise<AuthInfo>; }
```
- `DevJwtVerifier` (uses `jose` HS256 with a dev secret): verifies signature, checks `aud === resourceUri`, returns `{ sub, scopes }`. For local/dev + tests.
- `JwksVerifier` (uses `jose` `createRemoteJWKSet`): verifies RS256 against a JWKS URL, checks `aud` + `iss`. Adapter for a real authorization server (Auth0/Stytch/WorkOS). Typecheck only.
- [ ] TDD the `DevJwtVerifier`: a valid signed JWT with correct aud verifies; wrong aud rejected; bad signature rejected; expired rejected. Commit.

## Task 7: Protected Resource Metadata + auth middleware

`src/http/authMiddleware.ts` + `src/http/metadata.ts`:
- `protectedResourceMetadata(resourceUri, authServerUrl)` returns the RFC 9728 doc: `{ resource, authorization_servers: [authServerUrl], bearer_methods_supported: ["header"], scopes_supported }`.
- Express middleware: read `Authorization: Bearer <t>`; if absent/invalid, respond `401` with header `WWW-Authenticate: Bearer resource_metadata="<resourceUri>/.well-known/oauth-protected-resource"`; else call the `AuthVerifier`, attach `req.authInfo = { sub, scopes }`, and continue.
- [ ] TDD the middleware with the DevJwtVerifier (supertest or by calling the handler with mock req/res): missing token -> 401 + WWW-Authenticate; valid token -> next() with authInfo; the metadata doc shape. Commit.

## Task 8: LWA broker (Leg 2) + confused-deputy mitigations

`src/http/lwaBroker.ts` (express router), using the vault + consent store:
- `GET /connect` (auth required): requires `req.authInfo.sub`. Generate a single-use random `state`, store it server-side bound to `{ sub, clientId, redirectUri }` with a short TTL; verify the requesting `clientId`+`redirectUri` against the consent store (per-user approved registry) BEFORE redirecting; exact `redirectUri` match (no wildcards). Redirect to the LWA consent URL (`https://sellercentral.amazon.com/apps/authorize/consent?application_id=<appId>&state=<state>&redirect_uri=<ourCallback>`).
- `GET /callback`: validate `state` (exists, not expired, single-use -> delete), read `spapi_oauth_code` + `selling_partner_id`, exchange the code at the LWA token endpoint (`grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`) for a `refresh_token`, then `vault.storeConnection({ mcpUserId: sub, sellingPartnerId, refreshToken, marketplaceIds, ... })` and `consentStore.approve(...)`.
- NEVER forward the inbound MCP token to Amazon. Use a `__Host-` style secure state cookie OR a server-side state map (in-memory impl is fine here; interface it).
- [ ] TDD the pure logic: state generation/validation (single-use, expiry), exact redirect_uri match rejection, the code->token exchange (mock fetch) storing into the vault, and that an unapproved client/redirect is rejected before any LWA redirect. Commit.

## Task 9: Streamable HTTP server

`src/httpServer.ts` (NEW entry; keep `src/index.ts` stdio intact):
- Build an `express` app:
  - `GET /.well-known/oauth-protected-resource` -> the metadata doc (public).
  - mount the LWA broker router (`/connect`, `/callback`).
  - `POST /mcp` and `GET /mcp` -> auth middleware -> resolve the seller via `SellerClientFactory.forUser(req.authInfo.sub)` -> build a per-seller `McpServer` (reuse `buildServer`, deriving a per-seller config: region/sandbox from server env, `marketplaceIds` from the connection) -> connect a `StreamableHTTPServerTransport` (read the installed SDK type at `node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.*` for the exact API; use stateless or per-session per the SDK docs) and handle the request. On "seller not connected", return a clear JSON error pointing to `/connect`.
  - Validate the `Origin` header (per MCP transport security) and bind config from env (`PORT`, `PUBLIC_URL`, `AUTH_SERVER_URL`, `SPAPI_APP_ID`, LWA creds, `SPAPI_VAULT_KEY`, vault backend selector).
- A `src/serverConfig.ts` helper to load the hosting env (separate from the per-seller SP-API config).
- [ ] Wire it; `npm run typecheck` clean; `npm run build`. A smoke test: start the HTTP server with the DevJwtVerifier + in-memory vault seeded with a test connection, then (a) GET `/.well-known/oauth-protected-resource` returns 200 + the doc; (b) POST `/mcp` without a token returns 401 + WWW-Authenticate; (c) POST `/mcp` with a valid dev JWT performs an MCP `initialize` + `tools/list` and returns the tool list. Document this smoke in the task. Commit.

## Task 10: Notifications delivery consumer + recent_alerts

`src/notifications/eventStore.ts`: `NotificationEvent` type + `EventStore` interface + `InMemoryEventStore` (bounded ring buffer keyed by mcpUserId).
`src/notifications/sqsConsumer.ts`: an SQS consumer using `@aws-sdk/client-sqs` that long-polls a queue and pushes parsed events into an `EventStore` (type-checked; no live test).
`recent_alerts` tool (`src/mcp/tools/alerts.ts`): reads recent events for the current seller from the `EventStore`. In stdio/in-memory mode the store may be empty; the tool returns an empty list cleanly. Register in server.ts (the tool needs access to the store + the current mcpUserId; for stdio use the default user).
- [ ] TDD the in-memory store (push/read, ring-buffer cap) and the `recent_alerts` handler (returns events, empty when none). Commit.

## Task 11: Dockerfile + deploy docs + README

- `Dockerfile` (multi-stage: build with tsup, run `node dist/httpServer.js`).
- `docs/DEPLOY.md`: env vars, the DynamoDB table schema + KMS key + SQS queue + IAM notes, how to point an MCP client at the hosted URL, and the Data Protection Policy controls checklist (encryption, 30-day PII deletion, 12-month logs, incident reporting) as operational TODOs for production.
- Update `README.md`: document stdio (single-tenant) vs hosted (multi-tenant) modes and the two OAuth legs.
- [ ] Add files. Commit.

## Task 12: Final verification

- [ ] `npm test` (all green, incl. new), `npm run typecheck` (clean), `npm run build`. Run the stdio smoke (tools/list, ~37 tools incl. recent_alerts) AND the HTTP smoke from Task 9. Commit any final wiring.

## Acceptance criteria
- stdio single-tenant mode still works unchanged; all prior tests pass.
- Vault encrypts refresh tokens at rest (in-memory + local encryptor tested; DynamoDB + KMS adapters typecheck).
- Hosted mode: PRM served; 401+WWW-Authenticate on missing/invalid token; valid dev JWT -> per-seller tools/list works; /connect enforces consent + exact redirect_uri + single-use state; /callback exchanges the code and stores the encrypted refresh token; inbound MCP token is never forwarded to Amazon.
- recent_alerts tool present; notifications consumer + AWS adapters typecheck.
- Dockerfile builds conceptually (multi-stage); DEPLOY.md documents the AWS resources + DPP controls.
