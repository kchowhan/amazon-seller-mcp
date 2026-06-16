// src/serverConfig.ts
// Hosting configuration for the HTTP/multi-tenant mode.
// Loaded once at startup; separate from per-seller SP-API config.

import type { Region } from "./config";

export interface ServerConfig {
  port: number;
  /** Publicly reachable base URL (e.g. https://mcp.example.com). No trailing slash. */
  publicUrl: string;
  /** The MCP resource URI clients use in Authorization headers (publicUrl + "/mcp"). */
  mcpResourceUri: string;
  /** Auth server URL for RFC 9728 metadata (e.g. https://auth.example.com). */
  authServerUrl: string;
  /** Amazon SP-API application ID (used in LWA consent URL). */
  spapiAppId: string;
  /** LWA credentials for the SP-API application. */
  lwaClientId: string;
  lwaClientSecret: string;
  /** 32-byte base64 key for local AES-256-GCM vault encryption. */
  vaultKey: string;
  /** SP-API region (na | eu | fe). Default: "na". */
  region: Region;
  sandbox: boolean;
  /** Which vault backend to use. "memory" for dev/test; "dynamo" for prod. */
  vaultBackend: "memory" | "dynamo";
  /**
   * Auth mode. "dev" uses DevJwtVerifier with DEV_JWT_SECRET.
   * "jwks" uses JwksVerifier with JWKS_URI.
   */
  authMode: "dev" | "jwks";
  /** Only used when authMode === "dev". */
  devJwtSecret?: string;
  /** Only used when authMode === "jwks". */
  jwksUri?: string;
  /** Only used when authMode === "jwks". */
  jwtIssuer?: string;
  /** Dev-only: a test mcpUserId to seed the in-memory vault on startup. */
  devSeedUserId?: string;
  /** Dev-only: a plaintext refresh token to seed for devSeedUserId. */
  devSeedRefreshToken?: string;
  /** Dev-only: comma-separated marketplace IDs for the seeded connection. */
  devSeedMarketplaceIds?: string[];
  /**
   * Fallback marketplace IDs used when a seller connection has an empty
   * marketplaceIds list. Sourced from DEFAULT_MARKETPLACE_IDS env var
   * (comma-separated). Defaults to ["ATVPDKIKX0DER"] (US) when unset.
   */
  defaultMarketplaceIds: string[];
}

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const REGIONS: Region[] = ["na", "eu", "fe"];

export function loadServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const region = (env["SPAPI_REGION"] ?? "na") as Region;
  if (!REGIONS.includes(region)) {
    throw new Error(`Invalid SPAPI_REGION "${region}"; expected one of ${REGIONS.join(", ")}`);
  }

  const publicUrl = required(env, "PUBLIC_URL").replace(/\/$/, "");
  const authMode = (env["AUTH_MODE"] ?? "jwks") as "dev" | "jwks";
  const vaultBackend = (env["VAULT_BACKEND"] ?? "dynamo") as "memory" | "dynamo";

  const defaultMarketplaceIds = (env["DEFAULT_MARKETPLACE_IDS"] ?? "ATVPDKIKX0DER")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const config: ServerConfig = {
    port: parseInt(env["PORT"] ?? "3000", 10),
    publicUrl,
    mcpResourceUri: `${publicUrl}/mcp`,
    authServerUrl: required(env, "AUTH_SERVER_URL"),
    spapiAppId: required(env, "SPAPI_APP_ID"),
    lwaClientId: required(env, "LWA_CLIENT_ID"),
    lwaClientSecret: required(env, "LWA_CLIENT_SECRET"),
    vaultKey: required(env, "SPAPI_VAULT_KEY"),
    region,
    sandbox: (env["SPAPI_SANDBOX"] ?? "false").toLowerCase() === "true",
    vaultBackend,
    authMode,
    defaultMarketplaceIds,
  };

  if (authMode === "dev") {
    config.devJwtSecret = required(env, "DEV_JWT_SECRET");
  } else {
    config.jwksUri = required(env, "JWKS_URI");
    config.jwtIssuer = required(env, "JWT_ISSUER");
  }

  // Dev seed: optional in-memory vault pre-population for smoke tests.
  if (vaultBackend === "memory" && env["DEV_SEED_USER_ID"] && env["DEV_SEED_REFRESH_TOKEN"]) {
    config.devSeedUserId = env["DEV_SEED_USER_ID"];
    config.devSeedRefreshToken = env["DEV_SEED_REFRESH_TOKEN"];
    config.devSeedMarketplaceIds = (env["DEV_SEED_MARKETPLACE_IDS"] ?? "ATVPDKIKX0DER")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return config;
}
