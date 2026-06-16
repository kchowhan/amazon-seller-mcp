// src/operations/fbaInventory.ts
// FBA Inventory API v1
// Model: fba-inventory-api-model/fbaInventory.json
// Note: this API uses camelCase query params (marketplaceIds, granularityType, etc.)
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: getInventorySummaries 2/s burst 2.
const RATE_LIMIT = { rate: 2, burst: 2 };

export interface GetInventorySummariesParams {
  granularityType: string; // e.g. "Marketplace"
  granularityId: string;   // the marketplace ID when granularityType=Marketplace
  marketplaceIds: string[];
  details?: boolean;
  startDateTime?: string;
  sellerSkus?: string[];
  nextToken?: string;
}

export async function getInventorySummaries(
  client: SpApiClient,
  params: GetInventorySummariesParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "getInventorySummaries",
    method: "GET",
    path: "/fba/inventory/v1/summaries",
    query: {
      granularityType: params.granularityType,
      granularityId: params.granularityId,
      marketplaceIds: params.marketplaceIds,
      details: params.details !== undefined ? String(params.details) : undefined,
      startDateTime: params.startDateTime,
      sellerSkus: params.sellerSkus,
      nextToken: params.nextToken,
    },
    rateLimit: RATE_LIMIT,
  });
}
