// src/operations/pricing.ts
// Product Pricing API v0
// Model: product-pricing-api-model/productPricingV0.json
// IMPORTANT: this API uses PascalCase query params (MarketplaceId, Asins, Skus, ItemType, ItemCondition)
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: getCompetitivePricing 0.5/s burst 1; getItemOffers 0.5/s burst 1.
const COMPETITIVE_RATE = { rate: 0.5, burst: 1 };
const ITEM_OFFERS_RATE = { rate: 0.5, burst: 1 };

export interface GetCompetitivePricingParams {
  MarketplaceId: string;
  Asins?: string[];
  Skus?: string[];
  ItemType: "Asin" | "Sku";
  CustomerType?: string;
}

export interface GetItemOffersParams {
  Asin: string;
  MarketplaceId: string;
  ItemCondition: string; // e.g. "New", "Used", "Collectible", "Refurbished", "Club"
  CustomerType?: string;
}

export async function getCompetitivePricing(
  client: SpApiClient,
  params: GetCompetitivePricingParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "getCompetitivePricing",
    method: "GET",
    path: "/products/pricing/v0/competitivePrice",
    query: {
      MarketplaceId: params.MarketplaceId,
      Asins: params.Asins,
      Skus: params.Skus,
      ItemType: params.ItemType,
      CustomerType: params.CustomerType,
    },
    rateLimit: COMPETITIVE_RATE,
  });
}

export async function getItemOffers(
  client: SpApiClient,
  params: GetItemOffersParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "getItemOffers",
    method: "GET",
    path: `/products/pricing/v0/items/${params.Asin}/offers`,
    query: {
      MarketplaceId: params.MarketplaceId,
      ItemCondition: params.ItemCondition,
      CustomerType: params.CustomerType,
    },
    rateLimit: ITEM_OFFERS_RATE,
  });
}
