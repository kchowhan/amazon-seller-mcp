// src/operations/sales.ts
// Sales API v1
// Model: sales.json
// Required query params: marketplaceIds, interval, granularity
// Optional: granularityTimeZone, buyerType, fulfillmentNetwork, firstDayOfWeek, asin, sku
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: getOrderMetrics 0.5/s burst 15
const GET_RATE = { rate: 0.5, burst: 15 };

export type Granularity = "Hour" | "Day" | "Week" | "Month" | "Year" | "Total";

export interface GetOrderMetricsParams {
  marketplaceIds: string[];
  interval: string;
  granularity: Granularity;
  granularityTimeZone?: string;
  buyerType?: string;
  fulfillmentNetwork?: string;
  firstDayOfWeek?: string;
  asin?: string;
  sku?: string;
}

export interface Money {
  currencyCode: string;
  amount: string;
}

export interface OrderMetricsInterval {
  interval: string;
  unitCount: number;
  orderItemCount: number;
  orderCount: number;
  averageUnitPrice: Money;
  totalSales: Money;
}

export interface GetOrderMetricsResponse {
  payload?: OrderMetricsInterval[];
}

export async function getOrderMetrics(
  client: SpApiClient,
  params: GetOrderMetricsParams,
): Promise<GetOrderMetricsResponse> {
  return client.request<GetOrderMetricsResponse>({
    operation: "getOrderMetrics",
    method: "GET",
    path: "/sales/v1/orderMetrics",
    query: {
      marketplaceIds: params.marketplaceIds,
      interval: params.interval,
      granularity: params.granularity,
      granularityTimeZone: params.granularityTimeZone,
      buyerType: params.buyerType,
      fulfillmentNetwork: params.fulfillmentNetwork,
      firstDayOfWeek: params.firstDayOfWeek,
      asin: params.asin,
      sku: params.sku,
    },
    rateLimit: GET_RATE,
  });
}
