// src/http/lwaBroker.ts
// Leg 2: OAuth broker that connects our MCP users to Amazon LWA.
// GET /connect  (auth required): generate a single-use state, redirect to LWA consent URL.
// GET /callback             : validate state, exchange code, store SellerConnection.

import { Router, type Request, type Response as ExpressResponse } from "express";
import { randomBytes } from "node:crypto";
import type { TokenVault, SellerConnection, ConsentRecord, ConsentStore } from "../vault/types";
import type { AuthInfo } from "../auth/verifier";

// ─── State store interface + in-memory impl ───────────────────────────────────

export interface PendingState {
  sub: string;
  clientId: string;
  redirectUri: string;
  expiresAt: number;
}

export interface StateStore {
  create(state: string, data: PendingState): Promise<void>;
  /** Retrieves and DELETES the state entry (single-use). Returns undefined if absent or expired. */
  consume(state: string): Promise<PendingState | undefined>;
}

export class InMemoryStateStore implements StateStore {
  private readonly store = new Map<string, PendingState>();

  async create(state: string, data: PendingState): Promise<void> {
    this.store.set(state, data);
  }

  async consume(state: string): Promise<PendingState | undefined> {
    const entry = this.store.get(state);
    this.store.delete(state); // single-use: always delete, even if expired
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined; // expired
    return entry;
  }
}

// ─── LWA token exchange ───────────────────────────────────────────────────────

export interface LwaTokenResponse {
  refresh_token: string;
  access_token?: string;
  token_type?: string;
}

/** Fetch-compatible signature that returns the global fetch Response (not Express's). */
export type FetchLike = (url: string, init: RequestInit) => Promise<globalThis.Response>;

// ─── Broker config ────────────────────────────────────────────────────────────

export interface LwaBrokerConfig {
  /** Amazon SP-API application ID (used in the consent URL). */
  spapiAppId: string;
  /** The URL this server will receive callbacks on. Must match what's registered in SP-API. */
  callbackUrl: string;
  /** LWA token endpoint. */
  lwaTokenUrl: string;
  /** LWA app credentials. NEVER forwarded to Amazon as an inbound MCP token. */
  lwaClientId: string;
  lwaClientSecret: string;
  /** How long a pending state entry is valid (ms). Default: 10 minutes. */
  stateTtlMs?: number;
}

// ─── Router factory ───────────────────────────────────────────────────────────

/**
 * Creates the LWA broker router. Mount at /  (so /connect and /callback are the paths).
 *
 * The auth middleware must run BEFORE this router on the /connect route; the
 * router reads req.authInfo internally. /callback is public (authenticated by
 * the state token Amazon echoes back).
 */
export function createLwaBrokerRouter(
  vault: TokenVault,
  consentStore: ConsentStore,
  stateStore: StateStore,
  config: LwaBrokerConfig,
  fetchFn: FetchLike = globalThis.fetch as FetchLike,
): Router {
  const router = Router();
  const ttlMs = config.stateTtlMs ?? 10 * 60 * 1000;

  // GET /connect
  router.get("/connect", async (req: Request, res: ExpressResponse) => {
    const authInfo = (req as Request & { authInfo?: AuthInfo }).authInfo;
    if (!authInfo) {
      res.status(401).json({ error: "unauthorized", error_description: "Authentication required" });
      return;
    }

    const clientId = req.query["client_id"] as string | undefined;
    const redirectUri = req.query["redirect_uri"] as string | undefined;

    if (!clientId || !redirectUri) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "client_id and redirect_uri are required",
      });
      return;
    }

    // Check consent store: has this user approved this client + exact redirectUri?
    const approved = await consentStore.isApproved(authInfo.sub, clientId, redirectUri);
    if (!approved) {
      res.status(403).json({
        error: "access_denied",
        error_description: `Client ${clientId} with redirectUri ${redirectUri} is not approved for this user`,
      });
      return;
    }

    // Generate single-use state, bound to the session
    const state = randomBytes(24).toString("base64url");
    await stateStore.create(state, {
      sub: authInfo.sub,
      clientId,
      redirectUri,
      expiresAt: Date.now() + ttlMs,
    });

    // Build LWA consent URL (NEVER include the inbound MCP token here)
    const consentUrl = new URL(
      "https://sellercentral.amazon.com/apps/authorize/consent",
    );
    consentUrl.searchParams.set("application_id", config.spapiAppId);
    consentUrl.searchParams.set("state", state);
    consentUrl.searchParams.set("redirect_uri", config.callbackUrl);

    res.redirect(302, consentUrl.toString());
  });

  // GET /callback
  router.get("/callback", async (req: Request, res: ExpressResponse) => {
    const state = req.query["state"] as string | undefined;
    const spApiOauthCode = req.query["spapi_oauth_code"] as string | undefined;
    const sellingPartnerId = req.query["selling_partner_id"] as string | undefined;

    if (!state) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing state" });
      return;
    }

    // Validate + consume state (single-use)
    const pending = await stateStore.consume(state);
    if (!pending) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "Invalid, expired, or already-used state",
      });
      return;
    }

    if (!spApiOauthCode) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing spapi_oauth_code" });
      return;
    }

    // Exchange the authorization code for a refresh token at LWA.
    // NEVER forward the inbound MCP token here.
    let lwaResponse: LwaTokenResponse;
    try {
      lwaResponse = await exchangeCodeForToken({
        code: spApiOauthCode,
        redirectUri: config.callbackUrl,
        clientId: config.lwaClientId,
        clientSecret: config.lwaClientSecret,
        tokenUrl: config.lwaTokenUrl,
        fetchFn,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "LWA token exchange failed";
      res.status(502).json({ error: "upstream_error", error_description: msg });
      return;
    }

    // Store the connection (refreshToken is plaintext here; vault encrypts at rest)
    const now = Date.now();
    const connection: SellerConnection = {
      mcpUserId: pending.sub,
      sellingPartnerId: sellingPartnerId ?? undefined,
      marketplaceIds: [], // populated later from the SP-API account endpoints
      refreshToken: lwaResponse.refresh_token,
      createdAt: now,
      updatedAt: now,
    };
    await vault.storeConnection(connection);

    // Record consent
    const consentRecord: ConsentRecord = {
      mcpUserId: pending.sub,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      scopes: [],
      grantedAt: now,
    };
    await consentStore.approve(consentRecord);

    res.json({ success: true, message: "Amazon seller account connected successfully" });
  });

  return router;
}

// ─── Pure helper: exchange authorization code for tokens ─────────────────────

export async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  fetchFn: FetchLike;
}): Promise<LwaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const resp = await params.fetchFn(params.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LWA token exchange returned ${resp.status}: ${text}`);
  }

  return (await resp.json()) as LwaTokenResponse;
}
