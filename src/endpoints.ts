// src/endpoints.ts
import type { Region } from "./config";

export interface Endpoints {
  spApiBaseUrl: string;
  lwaTokenUrl: string;
}

const HOSTS: Record<Region, { prod: string; sandbox: string }> = {
  na: {
    prod: "https://sellingpartnerapi-na.amazon.com",
    sandbox: "https://sandbox.sellingpartnerapi-na.amazon.com",
  },
  eu: {
    prod: "https://sellingpartnerapi-eu.amazon.com",
    sandbox: "https://sandbox.sellingpartnerapi-eu.amazon.com",
  },
  fe: {
    prod: "https://sellingpartnerapi-fe.amazon.com",
    sandbox: "https://sandbox.sellingpartnerapi-fe.amazon.com",
  },
};

// LWA token endpoint is global, not per-region.
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

export function resolveEndpoints(region: Region, sandbox: boolean): Endpoints {
  const host = HOSTS[region];
  return {
    spApiBaseUrl: sandbox ? host.sandbox : host.prod,
    lwaTokenUrl: LWA_TOKEN_URL,
  };
}
