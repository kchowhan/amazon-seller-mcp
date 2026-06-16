// src/operations/solicitations.ts
// Solicitations API v1
// Model: solicitations.json
// Rate limits from model descriptions:
//   getSolicitationActionsForOrder:                      1/s  burst 5
//   createProductReviewAndSellerFeedbackSolicitation:    1/s  burst 5
//
// Note: The Solicitations API is NOT a restricted operation (no x-amazon-spds-restricted
// annotations in solicitations.json; not listed in the SP-API Tokens use-case guide).
import type { SpApiClient } from "../client";

const GET_ACTIONS_RATE = { rate: 1, burst: 5 };
const CREATE_SOLICITATION_RATE = { rate: 1, burst: 5 };

// -- getSolicitationActionsForOrder ----------------------------------------

export interface GetSolicitationActionsParams {
  amazonOrderId: string;
  /** camelCase per solicitations.json (maxItems: 1). */
  marketplaceIds: string[];
}

export interface SolicitationActionsResult {
  _links?: unknown;
  _embedded?: unknown;
  [key: string]: unknown;
}

/**
 * GET /solicitations/v1/orders/{amazonOrderId}
 * Returns solicitation action types available for the order.
 * Not a restricted operation (per SP-API Tokens use-case guide; no PII returned).
 */
export async function getSolicitationActionsForOrder(
  client: SpApiClient,
  params: GetSolicitationActionsParams,
): Promise<SolicitationActionsResult> {
  return client.request<SolicitationActionsResult>({
    operation: "getSolicitationActionsForOrder",
    method: "GET",
    path: `/solicitations/v1/orders/${params.amazonOrderId}`,
    query: { marketplaceIds: params.marketplaceIds },
    rateLimit: GET_ACTIONS_RATE,
  });
}

// -- createProductReviewAndSellerFeedbackSolicitation ----------------------

export interface CreateSolicitationParams {
  amazonOrderId: string;
  /** camelCase per solicitations.json (maxItems: 1). */
  marketplaceIds: string[];
}

export interface CreateSolicitationResult {
  [key: string]: unknown;
}

/**
 * POST /solicitations/v1/orders/{amazonOrderId}/solicitations/productReviewAndSellerFeedback
 * Sends a solicitation to the buyer to leave a product review and seller feedback.
 * No request body per solicitations.json.
 * Not a restricted operation (per SP-API Tokens use-case guide; no PII returned).
 */
export async function createProductReviewAndSellerFeedbackSolicitation(
  client: SpApiClient,
  params: CreateSolicitationParams,
): Promise<CreateSolicitationResult> {
  return client.request<CreateSolicitationResult>({
    operation: "createProductReviewAndSellerFeedbackSolicitation",
    method: "POST",
    path: `/solicitations/v1/orders/${params.amazonOrderId}/solicitations/productReviewAndSellerFeedback`,
    query: { marketplaceIds: params.marketplaceIds },
    rateLimit: CREATE_SOLICITATION_RATE,
  });
}
