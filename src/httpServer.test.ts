// src/httpServer.test.ts
// Supertest wiring tests for the multi-tenant HTTP server.
// Uses dev auth (HS256), in-memory vault, and no real SP-API calls.

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { buildApp } from "./httpServer";
import { mintDevJwt } from "./auth/verifier";
import { LocalEncryptor } from "./vault/localEncryptor";
import { InMemoryTokenVault } from "./vault/inMemoryVault";
import type { ServerConfig } from "./serverConfig";
import type { SellerConnection } from "./vault/types";

// ─── Shared test fixtures ────────────────────────────────────────────────────

const DEV_JWT_SECRET = "test-secret-for-http-wiring-tests-32b";
const PUBLIC_URL = "http://localhost:3000";
const MCP_RESOURCE_URI = `${PUBLIC_URL}/mcp`;
const TEST_USER_ID = "test-user-001";
const TEST_REFRESH_TOKEN = "Atzr|test-refresh-token";

function makeServerConfig(): ServerConfig {
  return {
    port: 3000,
    publicUrl: PUBLIC_URL,
    mcpResourceUri: MCP_RESOURCE_URI,
    authServerUrl: "https://auth.example.com",
    spapiAppId: "amzn1.sp.solution.test",
    lwaClientId: "amzn1.app.test",
    lwaClientSecret: "test-lwa-secret",
    vaultKey: randomBytes(32).toString("base64"),
    region: "na",
    sandbox: true,
    vaultBackend: "memory",
    authMode: "dev",
    devJwtSecret: DEV_JWT_SECRET,
    defaultMarketplaceIds: ["ATVPDKIKX0DER"],
  };
}

async function makeSeededVault(cfg: ServerConfig): Promise<InMemoryTokenVault> {
  const vault = new InMemoryTokenVault(new LocalEncryptor(cfg.vaultKey));
  const now = Date.now();
  const conn: SellerConnection = {
    mcpUserId: TEST_USER_ID,
    sellingPartnerId: "SELLER_TEST",
    marketplaceIds: ["ATVPDKIKX0DER"],
    refreshToken: TEST_REFRESH_TOKEN,
    createdAt: now,
    updatedAt: now,
  };
  await vault.storeConnection(conn);
  return vault;
}

async function makeValidToken(sub: string = TEST_USER_ID): Promise<string> {
  return mintDevJwt(DEV_JWT_SECRET, { sub, aud: MCP_RESOURCE_URI });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HTTP wiring: GET /.well-known/oauth-protected-resource", () => {
  it("returns 200 with resource and authorization_servers fields", async () => {
    const cfg = makeServerConfig();
    const app = buildApp(cfg);

    const res = await request(app).get("/.well-known/oauth-protected-resource");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      resource: MCP_RESOURCE_URI,
      authorization_servers: ["https://auth.example.com"],
    });
  });
});

describe("HTTP wiring: POST /mcp - auth enforcement", () => {
  it("returns 401 + WWW-Authenticate when no token is supplied", async () => {
    const cfg = makeServerConfig();
    const app = buildApp(cfg);

    const res = await request(app)
      .post("/mcp")
      .set("Content-Type", "application/json")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

    expect(res.status).toBe(401);
    expect(res.headers["www-authenticate"]).toMatch(/Bearer/i);
  });
});

describe("HTTP wiring: POST /mcp - valid token + seeded connection", () => {
  let app: ReturnType<typeof buildApp>;
  let token: string;

  beforeAll(async () => {
    const cfg = makeServerConfig();
    const vault = await makeSeededVault(cfg);
    app = buildApp(cfg, { vault });
    token = await makeValidToken();
  });

  it("returns a successful tools/list response containing a known tool name", async () => {
    // MCP Streamable HTTP requires Accept to list both application/json and text/event-stream.
    // The SDK responds with Content-Type: text/event-stream; the JSON payload is in
    // the SSE text body (data: {...}), not in res.body.
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

    expect(res.status).toBe(200);

    // Parse the SSE body: find the first "data: {...}" line and parse it as JSON.
    const sseText = res.text ?? "";
    const dataLine = sseText.split("\n").find((l) => l.startsWith("data: "));
    expect(dataLine).toBeDefined();
    const payload = JSON.parse(dataLine!.replace(/^data: /, "")) as {
      result?: { tools?: Array<{ name: string }> };
    };
    const toolNames = (payload.result?.tools ?? []).map((t) => t.name);
    expect(toolNames).toContain("sellers_get_marketplaces");
  });
});

describe("HTTP wiring: GET /connect - unapproved client is rejected before redirect", () => {
  it("returns 403 with no Location header for an unapproved client/redirect_uri", async () => {
    const cfg = makeServerConfig();
    const vault = await makeSeededVault(cfg);
    const app = buildApp(cfg, { vault });
    const token = await makeValidToken();

    const res = await request(app)
      .get("/connect")
      .set("Authorization", `Bearer ${token}`)
      .query({ client_id: "evil-client", redirect_uri: "https://evil.example.com/callback" });

    // Should reject before any redirect.
    expect(res.status).toBe(403);
    expect(res.headers["location"]).toBeUndefined();
  });
});

describe("HTTP wiring: Origin validation", () => {
  it("returns 403 for a POST /mcp request with a disallowed Origin header", async () => {
    const cfg = makeServerConfig();
    const vault = await makeSeededVault(cfg);
    const app = buildApp(cfg, { vault });
    const token = await makeValidToken();

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "http://evil.example.com")
      .set("Content-Type", "application/json")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: "forbidden" });
  });

  it("passes a request whose Origin exactly matches publicUrl", async () => {
    const cfg = makeServerConfig();
    const vault = await makeSeededVault(cfg);
    const app = buildApp(cfg, { vault });
    const token = await makeValidToken();

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", PUBLIC_URL)
      .set("Content-Type", "application/json")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

    // Should NOT be a 403 for the origin check.
    expect(res.status).not.toBe(403);
  });

  it("rejects a prefix-spoofing Origin (http://localhost:3000.evil.com)", async () => {
    const cfg = makeServerConfig();
    const vault = await makeSeededVault(cfg);
    const app = buildApp(cfg, { vault });
    const token = await makeValidToken();

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${token}`)
      .set("Origin", "http://localhost:3000.evil.com")
      .set("Content-Type", "application/json")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

    expect(res.status).toBe(403);
  });
});
