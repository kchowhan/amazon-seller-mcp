// src/operations/sellers.ts
import type { SpApiClient } from "../client";

export interface MarketplaceParticipation {
  marketplace: {
    id: string;
    name: string;
    countryCode: string;
    defaultCurrencyCode?: string;
    defaultLanguageCode?: string;
    domainName?: string;
  };
  participation: {
    isParticipating: boolean;
    hasSuspendedListings: boolean;
  };
}

// Rate limits per SP-API docs for this operation: rate 0.016/s, burst 15.
const RATE_LIMIT = { rate: 0.016, burst: 15 };

export async function getMarketplaceParticipations(
  client: SpApiClient,
): Promise<MarketplaceParticipation[]> {
  const res = await client.request<{ payload: MarketplaceParticipation[] }>({
    operation: "getMarketplaceParticipations",
    method: "GET",
    path: "/sellers/v1/marketplaceParticipations",
    rateLimit: RATE_LIMIT,
  });
  return res.payload;
}
