// src/config.ts
export type Region = "na" | "eu" | "fe";

export interface SpApiConfig {
  lwaClientId: string;
  lwaClientSecret: string;
  refreshToken: string;
  region: Region;
  marketplaceIds: string[];
  sandbox: boolean;
  sellerId?: string;
}

const REGIONS: Region[] = ["na", "eu", "fe"];

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): SpApiConfig {
  const region = (env.SPAPI_REGION ?? "na") as Region;
  if (!REGIONS.includes(region)) {
    throw new Error(`Invalid SPAPI_REGION "${region}"; expected one of ${REGIONS.join(", ")}`);
  }
  const marketplaceIds = required(env, "SPAPI_MARKETPLACE_IDS")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    lwaClientId: required(env, "LWA_CLIENT_ID"),
    lwaClientSecret: required(env, "LWA_CLIENT_SECRET"),
    refreshToken: required(env, "SPAPI_REFRESH_TOKEN"),
    region,
    marketplaceIds,
    sandbox: (env.SPAPI_SANDBOX ?? "false").toLowerCase() === "true",
    sellerId: env.SPAPI_SELLER_ID || undefined, // blank string treated as absent
  };
}
