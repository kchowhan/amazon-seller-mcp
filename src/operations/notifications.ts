// src/operations/notifications.ts
// Notifications API v1
// Model: notifications.json
//
// GRANTLESS ops (scope: sellingpartnerapi::notifications):
//   getDestinations, createDestination, deleteDestination,
//   deleteSubscriptionById
// SELLER-AUTHORIZED ops (no grantless):
//   createSubscription, getSubscription
import type { SpApiClient } from "../client";

const GRANTLESS_SCOPE = "sellingpartnerapi::notifications";

// Rate limits per SP-API docs (all ~1/s burst 5 unless noted)
const DEST_RATE = { rate: 1, burst: 5 };
const SUB_RATE = { rate: 1, burst: 5 };

// ---- Types ----

export interface SqsResource {
  arn: string;
}

export interface EventBridgeResource {
  region: string;
  accountId: string;
}

export interface DestinationResourceSpecification {
  sqs?: SqsResource;
  eventBridge?: EventBridgeResource;
}

export interface Destination {
  name: string;
  destinationId: string;
  resource: Record<string, unknown>;
}

export interface GetDestinationsResponse {
  payload?: Destination[];
}

export interface CreateDestinationRequest {
  name: string;
  resourceSpecification: DestinationResourceSpecification;
}

export interface CreateDestinationResponse {
  payload?: Destination;
}

export interface Subscription {
  subscriptionId: string;
  payloadVersion: string;
  destinationId: string;
}

export interface GetSubscriptionResponse {
  payload?: Subscription;
}

export interface CreateSubscriptionRequest {
  payloadVersion: string;
  destinationId: string;
}

export interface CreateSubscriptionResponse {
  payload?: Subscription;
}

// ---- Operations ----

export async function getDestinations(
  client: SpApiClient,
): Promise<GetDestinationsResponse> {
  return client.request<GetDestinationsResponse>({
    operation: "getDestinations",
    method: "GET",
    path: "/notifications/v1/destinations",
    rateLimit: DEST_RATE,
    grantless: { scope: GRANTLESS_SCOPE },
  });
}

export async function createDestination(
  client: SpApiClient,
  params: CreateDestinationRequest,
): Promise<CreateDestinationResponse> {
  return client.request<CreateDestinationResponse>({
    operation: "createDestination",
    method: "POST",
    path: "/notifications/v1/destinations",
    body: {
      name: params.name,
      resourceSpecification: params.resourceSpecification,
    },
    rateLimit: DEST_RATE,
    grantless: { scope: GRANTLESS_SCOPE },
  });
}

export async function deleteDestination(
  client: SpApiClient,
  destinationId: string,
): Promise<void> {
  return client.request<void>({
    operation: "deleteDestination",
    method: "DELETE",
    path: `/notifications/v1/destinations/${destinationId}`,
    rateLimit: DEST_RATE,
    grantless: { scope: GRANTLESS_SCOPE },
  });
}

export async function createSubscription(
  client: SpApiClient,
  notificationType: string,
  params: CreateSubscriptionRequest,
): Promise<CreateSubscriptionResponse> {
  return client.request<CreateSubscriptionResponse>({
    operation: "createSubscription",
    method: "POST",
    path: `/notifications/v1/subscriptions/${notificationType}`,
    body: {
      payloadVersion: params.payloadVersion,
      destinationId: params.destinationId,
    },
    rateLimit: SUB_RATE,
    // NOT grantless — seller-authorized
  });
}

export async function getSubscription(
  client: SpApiClient,
  notificationType: string,
): Promise<GetSubscriptionResponse> {
  return client.request<GetSubscriptionResponse>({
    operation: "getSubscription",
    method: "GET",
    path: `/notifications/v1/subscriptions/${notificationType}`,
    rateLimit: SUB_RATE,
    // NOT grantless — seller-authorized
  });
}

export async function deleteSubscriptionById(
  client: SpApiClient,
  notificationType: string,
  subscriptionId: string,
): Promise<void> {
  return client.request<void>({
    operation: "deleteSubscriptionById",
    method: "DELETE",
    path: `/notifications/v1/subscriptions/${notificationType}/${subscriptionId}`,
    rateLimit: SUB_RATE,
    grantless: { scope: GRANTLESS_SCOPE },
  });
}
