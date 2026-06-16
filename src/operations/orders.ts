// src/operations/orders.ts
// Orders API v0
// Model: ordersV0.json
// Rate limits from model descriptions:
//   getOrders:          0.0167/s burst 20
//   getOrder:           0.5/s   burst 30
//   getOrderItems:      0.5/s   burst 30
//   confirmShipment:    2/s     burst 10
import type { SpApiClient } from "../client";

const GET_ORDERS_RATE = { rate: 0.0167, burst: 20 };
const GET_ORDER_RATE = { rate: 0.5, burst: 30 };
const GET_ORDER_ITEMS_RATE = { rate: 0.5, burst: 30 };
const CONFIRM_SHIPMENT_RATE = { rate: 2, burst: 10 };

// -- getOrders --------------------------------------------------------------

export interface GetOrdersParams {
  /** Required. PascalCase per ordersV0.json. */
  MarketplaceIds: string[];
  CreatedAfter?: string;
  CreatedBefore?: string;
  LastUpdatedAfter?: string;
  LastUpdatedBefore?: string;
  OrderStatuses?: string[];
  FulfillmentChannels?: string[];
  PaymentMethods?: string[];
  BuyerEmail?: string;
  SellerOrderId?: string;
  MaxResultsPerPage?: number;
  NextToken?: string;
}

export interface OrdersList {
  payload?: {
    Orders?: unknown[];
    NextToken?: string;
    LastUpdatedBefore?: string;
    CreatedBefore?: string;
  };
}

/**
 * GET /orders/v0/orders
 * Includes buyer PII via RDT scoped to buyerInfo + shippingAddress.
 */
export async function getOrders(
  client: SpApiClient,
  params: GetOrdersParams,
): Promise<OrdersList> {
  return client.request<OrdersList>({
    operation: "getOrders",
    method: "GET",
    path: "/orders/v0/orders",
    query: {
      MarketplaceIds: params.MarketplaceIds,
      CreatedAfter: params.CreatedAfter,
      CreatedBefore: params.CreatedBefore,
      LastUpdatedAfter: params.LastUpdatedAfter,
      LastUpdatedBefore: params.LastUpdatedBefore,
      OrderStatuses: params.OrderStatuses,
      FulfillmentChannels: params.FulfillmentChannels,
      PaymentMethods: params.PaymentMethods,
      BuyerEmail: params.BuyerEmail,
      SellerOrderId: params.SellerOrderId,
      MaxResultsPerPage: params.MaxResultsPerPage,
      NextToken: params.NextToken,
    },
    rateLimit: GET_ORDERS_RATE,
    restrictedResources: [
      {
        method: "GET",
        path: "/orders/v0/orders",
        dataElements: ["buyerInfo", "shippingAddress"],
      },
    ],
  });
}

// -- getOrder ---------------------------------------------------------------

export interface OrderResult {
  payload?: unknown;
}

/**
 * GET /orders/v0/orders/{orderId}
 * Includes buyer PII via RDT scoped to buyerInfo + shippingAddress.
 * The restrictedResources path uses the same concrete orderId as the request path.
 */
export async function getOrder(
  client: SpApiClient,
  orderId: string,
): Promise<OrderResult> {
  const path = `/orders/v0/orders/${orderId}`;
  return client.request<OrderResult>({
    operation: "getOrder",
    method: "GET",
    path,
    rateLimit: GET_ORDER_RATE,
    restrictedResources: [
      {
        method: "GET",
        path,
        dataElements: ["buyerInfo", "shippingAddress"],
      },
    ],
  });
}

// -- getOrderItems ----------------------------------------------------------

export interface OrderItemsResult {
  payload?: unknown;
}

/**
 * GET /orders/v0/orders/{orderId}/orderItems
 * Includes buyer PII via RDT scoped to buyerInfo.
 * The restrictedResources path uses the same concrete orderId as the request path.
 */
export async function getOrderItems(
  client: SpApiClient,
  orderId: string,
  nextToken?: string,
): Promise<OrderItemsResult> {
  const path = `/orders/v0/orders/${orderId}/orderItems`;
  return client.request<OrderItemsResult>({
    operation: "getOrderItems",
    method: "GET",
    path,
    query: { NextToken: nextToken },
    rateLimit: GET_ORDER_ITEMS_RATE,
    restrictedResources: [
      {
        method: "GET",
        path,
        dataElements: ["buyerInfo"],
      },
    ],
  });
}

// -- confirmShipment --------------------------------------------------------

export interface PackageDetail {
  packageReferenceId: string;
  carrierCode: string;
  trackingNumber: string;
  shipDate: string;
  orderItems: unknown[];
  carrierName?: string;
  shippingMethod?: string;
  shipFromSupplySourceId?: string;
}

export interface ConfirmShipmentParams {
  orderId: string;
  marketplaceId: string;
  packageDetail: PackageDetail;
  codCollectionMethod?: "DirectPayment";
}

export interface ConfirmShipmentResponse {
  [key: string]: unknown;
}

/**
 * POST /orders/v0/orders/{orderId}/shipmentConfirmation
 * confirmShipment is NOT a restricted operation (no PII returned; ordersV0.json
 * has no restricted annotation and the Tokens API Use Case Guide does not list it).
 */
export async function confirmShipment(
  client: SpApiClient,
  params: ConfirmShipmentParams,
): Promise<ConfirmShipmentResponse> {
  return client.request<ConfirmShipmentResponse>({
    operation: "confirmShipment",
    method: "POST",
    path: `/orders/v0/orders/${params.orderId}/shipmentConfirmation`,
    body: {
      marketplaceId: params.marketplaceId,
      packageDetail: params.packageDetail,
      ...(params.codCollectionMethod !== undefined
        ? { codCollectionMethod: params.codCollectionMethod }
        : {}),
    },
    rateLimit: CONFIRM_SHIPMENT_RATE,
  });
}
