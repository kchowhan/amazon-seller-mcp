// src/operations/tokens.ts
// Tokens API 2021-03-01
// Model: tokens_2021-03-01.json
// Path: POST /tokens/2021-03-01/restrictedDataToken
// Rate limit: 1 req/s, burst 10
import type { SpApiClient, RequestOptions } from "../client";

export type RestrictedResource = NonNullable<RequestOptions["restrictedResources"]>[number];

export interface CreateRestrictedDataTokenResponse {
  restrictedDataToken: string;
  expiresIn: number;
}

const TOKEN_RATE = { rate: 1, burst: 10 };

/**
 * Explicitly call the Tokens API to mint a Restricted Data Token.
 * In most cases callers should set restrictedResources on their RequestOptions instead
 * (the client's mintRdt handles this automatically). Use this wrapper when you need
 * the token value directly (e.g. for delegation or inspection).
 */
export async function createRestrictedDataToken(
  client: SpApiClient,
  restrictedResources: RestrictedResource[],
): Promise<CreateRestrictedDataTokenResponse> {
  return client.request<CreateRestrictedDataTokenResponse>({
    operation: "createRestrictedDataToken",
    method: "POST",
    path: "/tokens/2021-03-01/restrictedDataToken",
    body: { restrictedResources },
    rateLimit: TOKEN_RATE,
  });
}
