// src/operations/finances.ts
// Finances API v0
// Model: financesV0.json
// Query param casing confirmed: MaxResultsPerPage, PostedAfter, PostedBefore, NextToken
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: listFinancialEvents 0.5/s burst 30
const LIST_RATE = { rate: 0.5, burst: 30 };

export interface ListFinancialEventsParams {
  MaxResultsPerPage?: number;
  PostedAfter?: string;
  PostedBefore?: string;
  NextToken?: string;
}

export interface ListFinancialEventsResponse {
  payload?: {
    NextToken?: string;
    FinancialEvents?: Record<string, unknown>;
  };
}

export async function listFinancialEvents(
  client: SpApiClient,
  params: ListFinancialEventsParams = {},
): Promise<ListFinancialEventsResponse> {
  return client.request<ListFinancialEventsResponse>({
    operation: "listFinancialEvents",
    method: "GET",
    path: "/finances/v0/financialEvents",
    query: {
      MaxResultsPerPage: params.MaxResultsPerPage,
      PostedAfter: params.PostedAfter,
      PostedBefore: params.PostedBefore,
      NextToken: params.NextToken,
    },
    rateLimit: LIST_RATE,
  });
}
