// src/operations/productTypes.ts
// Product Type Definitions API 2020-09-01
// Model: definitionsProductTypes_2020-09-01.json
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: getDefinitionsProductType 5/s burst 10.
const RATE_LIMIT = { rate: 5, burst: 10 };

export interface GetDefinitionsProductTypeParams {
  productType: string;
  marketplaceIds: string[];
  productTypeVersion?: string;
  requirements?: string;
  requirementsEnforced?: string;
  locale?: string;
}

export async function getDefinitionsProductType(
  client: SpApiClient,
  params: GetDefinitionsProductTypeParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "getDefinitionsProductType",
    method: "GET",
    path: `/definitions/2020-09-01/productTypes/${params.productType}`,
    query: {
      marketplaceIds: params.marketplaceIds,
      productTypeVersion: params.productTypeVersion,
      requirements: params.requirements,
      requirementsEnforced: params.requirementsEnforced,
      locale: params.locale,
    },
    rateLimit: RATE_LIMIT,
  });
}
