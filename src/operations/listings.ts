// src/operations/listings.ts
// Listings Items API 2021-08-01
// Model: listingsItems_2021-08-01.json
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: listings items 5/s burst 10.
const RATE_LIMIT = { rate: 5, burst: 10 };

export interface GetListingsItemParams {
  sellerId: string;
  sku: string;
  marketplaceIds: string[];
  includedData?: string[];
  issueLocale?: string;
}

export interface PutListingsItemBody {
  productType: string;
  requirements?: string;
  attributes: Record<string, unknown>;
}

export interface PutListingsItemParams {
  sellerId: string;
  sku: string;
  marketplaceIds: string[];
  body: PutListingsItemBody;
  includedData?: string[];
  mode?: string;
  issueLocale?: string;
}

export interface PatchOperation {
  op: string;
  path: string;
  value?: unknown;
}

export interface PatchListingsItemBody {
  productType: string;
  patches: PatchOperation[];
}

export interface PatchListingsItemParams {
  sellerId: string;
  sku: string;
  marketplaceIds: string[];
  body: PatchListingsItemBody;
  includedData?: string[];
  mode?: string;
  issueLocale?: string;
}

export interface DeleteListingsItemParams {
  sellerId: string;
  sku: string;
  marketplaceIds: string[];
  issueLocale?: string;
}

export async function getListingsItem(
  client: SpApiClient,
  params: GetListingsItemParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "getListingsItem",
    method: "GET",
    path: `/listings/2021-08-01/items/${params.sellerId}/${params.sku}`,
    query: {
      marketplaceIds: params.marketplaceIds,
      includedData: params.includedData,
      issueLocale: params.issueLocale,
    },
    rateLimit: RATE_LIMIT,
  });
}

export async function putListingsItem(
  client: SpApiClient,
  params: PutListingsItemParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "putListingsItem",
    method: "PUT",
    path: `/listings/2021-08-01/items/${params.sellerId}/${params.sku}`,
    query: {
      marketplaceIds: params.marketplaceIds,
      includedData: params.includedData,
      mode: params.mode,
      issueLocale: params.issueLocale,
    },
    body: params.body,
    rateLimit: RATE_LIMIT,
  });
}

export async function patchListingsItem(
  client: SpApiClient,
  params: PatchListingsItemParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "patchListingsItem",
    method: "PATCH",
    path: `/listings/2021-08-01/items/${params.sellerId}/${params.sku}`,
    query: {
      marketplaceIds: params.marketplaceIds,
      includedData: params.includedData,
      mode: params.mode,
      issueLocale: params.issueLocale,
    },
    body: params.body,
    rateLimit: RATE_LIMIT,
  });
}

export async function deleteListingsItem(
  client: SpApiClient,
  params: DeleteListingsItemParams,
): Promise<unknown> {
  return client.request<unknown>({
    operation: "deleteListingsItem",
    method: "DELETE",
    path: `/listings/2021-08-01/items/${params.sellerId}/${params.sku}`,
    query: {
      marketplaceIds: params.marketplaceIds,
      issueLocale: params.issueLocale,
    },
    rateLimit: RATE_LIMIT,
  });
}
