// src/httpServer.ts
// Multi-tenant hosted MCP server. Entry point for HTTP mode.
// Does NOT modify src/index.ts (stdio) in any way.

import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./mcp/server.js";
import { InMemoryEventStore } from "./notifications/eventStore.js";
import { SellerClientFactory } from "./sellerClient.js";
import { resolveEndpoints } from "./endpoints.js";
import { LocalEncryptor } from "./vault/localEncryptor.js";
import { InMemoryTokenVault } from "./vault/inMemoryVault.js";
import { InMemoryConsentStore } from "./vault/inMemoryVault.js";
import { InMemoryStateStore, createLwaBrokerRouter } from "./http/lwaBroker.js";
import { DevJwtVerifier, JwksVerifier } from "./auth/verifier.js";
import { createAuthMiddleware } from "./http/authMiddleware.js";
import { protectedResourceMetadata } from "./http/metadata.js";
import { loadServerConfig, type ServerConfig } from "./serverConfig.js";
import type { SpApiConfig } from "./config.js";
import type { SellerConnection, TokenVault } from "./vault/types.js";

// ─── Injectable deps (for tests) ────────────────────────────────────────────

export interface BuildAppDeps {
  /** Override the vault used by the app. Useful in tests to pre-seed connections. */
  vault?: TokenVault;
}

// ─── Build the Express app ───────────────────────────────────────────────────

export function buildApp(serverCfg: ServerConfig, deps?: BuildAppDeps) {
  const app = express();
  app.use(express.json());

  // ── Origin header validation (MCP transport security requirement) ───────────
  // Only applied to /mcp routes; the PRM endpoint and OAuth flows are public/redirect.
  //
  // Security: we use EXACT origin comparison only. The previous startsWith check
  // was bypassable (e.g. http://localhost:3000.evil.com would pass against
  // http://localhost:3000). We now parse both origins with `new URL` and compare
  // the canonicalized `.origin` property (scheme + host + port) for an exact match.
  const allowedOrigin = new URL(serverCfg.publicUrl).origin;

  function validateOrigin(req: Request, res: Response): boolean {
    const originHeader = req.headers["origin"];
    if (!originHeader) {
      // Non-browser clients (curl, MCP clients) don't send Origin — allow them.
      return true;
    }
    // Parse incoming Origin to canonicalize and guard against prefix-matching attacks.
    let parsedOrigin: string;
    try {
      parsedOrigin = new URL(originHeader).origin;
    } catch {
      // Malformed Origin header: reject.
      res.status(403).json({ error: "forbidden", error_description: "Origin not allowed" });
      return false;
    }
    if (parsedOrigin === allowedOrigin) {
      return true;
    }
    res.status(403).json({ error: "forbidden", error_description: "Origin not allowed" });
    return false;
  }

  // ── Shared event store (notifications from SQS consumer) ────────────────────
  // A single InMemoryEventStore is shared across all per-request buildServer calls
  // so that SQS-delivered notifications persist across requests for the same user.
  const sharedEventStore = new InMemoryEventStore();

  // ── Vault + encryptor ────────────────────────────────────────────────────────
  // Use injected vault (tests) or build the default in-memory vault.
  const encryptor = new LocalEncryptor(serverCfg.vaultKey);
  const vault: TokenVault = deps?.vault ?? new InMemoryTokenVault(encryptor);

  // Dev seed: pre-populate vault with a test seller connection for smoke testing.
  if (
    serverCfg.vaultBackend === "memory" &&
    serverCfg.devSeedUserId &&
    serverCfg.devSeedRefreshToken
  ) {
    const now = Date.now();
    const seedConn: SellerConnection = {
      mcpUserId: serverCfg.devSeedUserId,
      marketplaceIds: serverCfg.devSeedMarketplaceIds ?? ["ATVPDKIKX0DER"],
      refreshToken: serverCfg.devSeedRefreshToken,
      createdAt: now,
      updatedAt: now,
    };
    // Fire-and-forget; vault.storeConnection is async but we're at startup.
    vault.storeConnection(seedConn).catch((err: unknown) => {
      console.error("[dev-seed] Failed to seed vault:", err);
    });
  }

  // ── Auth verifier (Leg 1) ────────────────────────────────────────────────────
  const verifier =
    serverCfg.authMode === "dev"
      ? new DevJwtVerifier(serverCfg.devJwtSecret!)
      : new JwksVerifier(serverCfg.jwksUri!, serverCfg.jwtIssuer!);

  // Note (M-5): scopes on the JWT (e.g. "seller:read", "seller:write") are advisory-only
  // for now; the auth middleware verifies the token signature and audience but does not
  // enforce per-tool scope gating. Scope enforcement is deferred to a follow-up.
  const authMiddleware = createAuthMiddleware(verifier, serverCfg.mcpResourceUri);

  // ── Seller client factory ────────────────────────────────────────────────────
  const endpoints = resolveEndpoints(serverCfg.region, serverCfg.sandbox);
  const factory = new SellerClientFactory(vault, endpoints, {
    clientId: serverCfg.lwaClientId,
    clientSecret: serverCfg.lwaClientSecret,
  });

  // ── RFC 9728 Protected Resource Metadata (public) ───────────────────────────
  app.get("/.well-known/oauth-protected-resource", (_req, res) => {
    const doc = protectedResourceMetadata(serverCfg.mcpResourceUri, serverCfg.authServerUrl);
    res.json(doc);
  });

  // ── LWA broker router (Leg 2) ────────────────────────────────────────────────
  const consentStore = new InMemoryConsentStore();
  const stateStore = new InMemoryStateStore();
  const brokerRouter = createLwaBrokerRouter(
    vault,
    consentStore,
    stateStore,
    {
      spapiAppId: serverCfg.spapiAppId,
      callbackUrl: `${serverCfg.publicUrl}/callback`,
      lwaTokenUrl: "https://api.amazon.com/auth/o2/token",
      lwaClientId: serverCfg.lwaClientId,
      lwaClientSecret: serverCfg.lwaClientSecret,
    },
    globalThis.fetch as Parameters<typeof createLwaBrokerRouter>[4],
    // M-2: invalidate the cached client when a seller re-authorizes so the new
    // refresh token takes effect immediately without a server restart.
    factory.invalidate.bind(factory),
  );
  // /connect requires auth; /callback is public (authenticated by state token)
  app.get("/connect", authMiddleware, (req, res, next) => brokerRouter(req, res, next));
  app.get("/callback", (req, res, next) => brokerRouter(req, res, next));

  // ── MCP Streamable HTTP endpoint ─────────────────────────────────────────────
  // We use STATELESS mode (sessionIdGenerator: undefined). Each request is
  // independently authenticated via the Bearer token and resolves its own
  // per-seller McpServer. This avoids session-state fan-out complexity.
  async function handleMcp(req: Request, res: Response): Promise<void> {
    if (!validateOrigin(req, res)) return;

    const authInfo = (req as Request & { authInfo?: { sub: string; scopes: string[] } }).authInfo;
    if (!authInfo) {
      // Shouldn't happen (authMiddleware runs first) but be defensive.
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    let client, connection;
    try {
      ({ client, connection } = await factory.forUser(authInfo.sub));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("seller not connected")) {
        res.status(403).json({
          error: "seller_not_connected",
          error_description:
            "This MCP user has no connected Amazon seller account. " +
            `Complete the OAuth flow at ${serverCfg.publicUrl}/connect first.`,
        });
        return;
      }
      res.status(500).json({ error: "internal_error", error_description: msg });
      return;
    }

    // Derive a per-seller SpApiConfig from server env + vault connection.
    // M-4: use the connection's own marketplaceIds when present; fall back to
    // the server-configured default (DEFAULT_MARKETPLACE_IDS env var) rather
    // than always hard-coding US ("ATVPDKIKX0DER").
    const spApiConfig: SpApiConfig = {
      lwaClientId: serverCfg.lwaClientId,
      lwaClientSecret: serverCfg.lwaClientSecret,
      refreshToken: connection.refreshToken,
      region: serverCfg.region,
      marketplaceIds: connection.marketplaceIds.length > 0
        ? connection.marketplaceIds
        : serverCfg.defaultMarketplaceIds,
      sandbox: serverCfg.sandbox,
      sellerId: connection.sellingPartnerId,
    };

    const mcpServer = buildServer(client, spApiConfig, sharedEventStore, authInfo.sub);

    // Stateless transport: sessionIdGenerator is undefined.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  app.post("/mcp", authMiddleware, handleMcp);
  app.get("/mcp", authMiddleware, handleMcp);

  return app;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const serverCfg = loadServerConfig(process.env);
  const app = buildApp(serverCfg);

  app.listen(serverCfg.port, () => {
    console.log(`[amazon-seller-mcp] HTTP server listening on port ${serverCfg.port}`);
    console.log(`[amazon-seller-mcp] MCP resource URI: ${serverCfg.mcpResourceUri}`);
    console.log(`[amazon-seller-mcp] Auth mode: ${serverCfg.authMode}`);
    console.log(`[amazon-seller-mcp] Vault backend: ${serverCfg.vaultBackend}`);
    if (serverCfg.vaultBackend === "memory" && serverCfg.devSeedUserId) {
      console.log(`[amazon-seller-mcp] Dev seed: mcpUserId=${serverCfg.devSeedUserId}`);
    }
  });
}

// Only run the server when this file is executed directly (not imported in tests).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((err: unknown) => {
    console.error("[amazon-seller-mcp] Fatal startup error:", err);
    process.exit(1);
  });
}
