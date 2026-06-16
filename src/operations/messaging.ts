// src/operations/messaging.ts
// Messaging API v1
// Model: messaging.json
// Rate limits from model descriptions:
//   getMessagingActionsForOrder:    1/s  burst 5
//   createConfirmDeliveryDetails:   1/s  burst 5
//
// Note: The Messaging API is NOT a restricted operation (no x-amazon-spds-restricted
// annotations in messaging.json; not listed in the SP-API Tokens use-case guide).
// Amazon does constrain buyer-seller messaging to specific permitted action types.
import type { SpApiClient } from "../client";

const GET_ACTIONS_RATE = { rate: 1, burst: 5 };
const CREATE_MESSAGE_RATE = { rate: 1, burst: 5 };

// -- getMessagingActionsForOrder --------------------------------------------

export interface GetMessagingActionsParams {
  amazonOrderId: string;
  /** camelCase per messaging.json (maxItems: 1). */
  marketplaceIds: string[];
}

export interface MessagingActionsResult {
  _links?: unknown;
  _embedded?: unknown;
  [key: string]: unknown;
}

/**
 * GET /messaging/v1/orders/{amazonOrderId}
 * Returns the list of message types available for the order.
 * Not a restricted operation (no PII returned; not in SP-API Tokens use-case guide).
 */
export async function getMessagingActionsForOrder(
  client: SpApiClient,
  params: GetMessagingActionsParams,
): Promise<MessagingActionsResult> {
  return client.request<MessagingActionsResult>({
    operation: "getMessagingActionsForOrder",
    method: "GET",
    path: `/messaging/v1/orders/${params.amazonOrderId}`,
    query: { marketplaceIds: params.marketplaceIds },
    rateLimit: GET_ACTIONS_RATE,
  });
}

// -- createConfirmDeliveryDetails -------------------------------------------

export interface CreateConfirmDeliveryDetailsParams {
  amazonOrderId: string;
  /** camelCase per messaging.json (maxItems: 1). */
  marketplaceIds: string[];
  /** Message text (1-2000 chars). Only delivery-related links allowed. */
  text: string;
}

export interface CreateMessageResult {
  [key: string]: unknown;
}

/**
 * POST /messaging/v1/orders/{amazonOrderId}/messages/confirmDeliveryDetails
 * Sends a delivery confirmation message to the buyer.
 * Not a restricted operation (no PII returned; not in SP-API Tokens use-case guide).
 * operationId confirmed in messaging.json: createConfirmDeliveryDetails.
 */
export async function createConfirmDeliveryDetails(
  client: SpApiClient,
  params: CreateConfirmDeliveryDetailsParams,
): Promise<CreateMessageResult> {
  return client.request<CreateMessageResult>({
    operation: "createConfirmDeliveryDetails",
    method: "POST",
    path: `/messaging/v1/orders/${params.amazonOrderId}/messages/confirmDeliveryDetails`,
    query: { marketplaceIds: params.marketplaceIds },
    body: { text: params.text },
    rateLimit: CREATE_MESSAGE_RATE,
  });
}
