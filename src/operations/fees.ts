// src/operations/fees.ts
// Product Fees API v0
// Model: product-fees-api-model/productFeesV0.json
// IMPORTANT: this API uses PascalCase body fields (FeesEstimateRequest, MarketplaceId, etc.)
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: getMyFeesEstimateForASIN 0.1/s burst 1.
const RATE_LIMIT = { rate: 0.1, burst: 1 };

export interface FeesEstimateRequestBody {
  FeesEstimateRequest: {
    MarketplaceId: string;
    IsAmazonFulfilled?: boolean;
    Identifier: string;
    PriceToEstimateFees: {
      ListingPrice: {
        CurrencyCode: string;
        Amount: number;
      };
    };
  };
}

export interface GetMyFeesEstimateForASINParams extends FeesEstimateRequestBody {
  Asin: string;
}

export async function getMyFeesEstimateForASIN(
  client: SpApiClient,
  params: GetMyFeesEstimateForASINParams,
): Promise<unknown> {
  const { Asin, ...body } = params;
  return client.request<unknown>({
    operation: "getMyFeesEstimateForASIN",
    method: "POST",
    path: `/products/fees/v0/items/${Asin}/feesEstimate`,
    body,
    rateLimit: RATE_LIMIT,
  });
}
