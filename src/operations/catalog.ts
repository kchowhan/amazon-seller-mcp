// src/operations/catalog.ts
// Catalog Items API 2022-04-01
// Model: catalogItems_2022-04-01.json
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: searchCatalogItems 2/s burst 2, getCatalogItem 2/s burst 2.
const SEARCH_RATE = { rate: 2, burst: 2 };
const GET_RATE = { rate: 2, burst: 2 };

export interface SearchCatalogItemsParams {
  marketplaceIds: string[];
  keywords?: string[];
  identifiers?: string[];
  identifiersType?: string;
  includedData?: string[];
  locale?: string;
  sellerId?: string;
  brandNames?: string[];
  classificationIds?: string[];
  pageSize?: number;
  pageToken?: string;
  keywordsLocale?: string;
}

export interface GetCatalogItemParams {
  asin: string;
  marketplaceIds: string[];
  includedData?: string[];
  locale?: string;
}

export async function searchCatalogItems(
  client: SpApiClient,
  params: SearchCatalogItemsParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "searchCatalogItems",
    method: "GET",
    path: "/catalog/2022-04-01/items",
    query: {
      marketplaceIds: params.marketplaceIds,
      keywords: params.keywords,
      identifiers: params.identifiers,
      identifiersType: params.identifiersType,
      includedData: params.includedData,
      locale: params.locale,
      sellerId: params.sellerId,
      brandNames: params.brandNames,
      classificationIds: params.classificationIds,
      pageSize: params.pageSize,
      pageToken: params.pageToken,
      keywordsLocale: params.keywordsLocale,
    },
    rateLimit: SEARCH_RATE,
  });
}

export async function getCatalogItem(
  client: SpApiClient,
  params: GetCatalogItemParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "getCatalogItem",
    method: "GET",
    path: `/catalog/2022-04-01/items/${params.asin}`,
    query: {
      marketplaceIds: params.marketplaceIds,
      includedData: params.includedData,
      locale: params.locale,
    },
    rateLimit: GET_RATE,
  });
}
