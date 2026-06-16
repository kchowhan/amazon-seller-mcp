// src/operations/reports.ts
// Reports API 2021-06-30
// Model: reports_2021-06-30.json
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: createReport 0.0167/s burst 15, getReport 2/s burst 15,
// getReportDocument 0.0167/s burst 15.
const CREATE_RATE = { rate: 0.0167, burst: 15 };
const GET_RATE = { rate: 2, burst: 15 };
const DOC_RATE = { rate: 0.0167, burst: 15 };

export interface CreateReportParams {
  reportType: string;
  marketplaceIds: string[];
  dataStartTime?: string;
  dataEndTime?: string;
  reportOptions?: Record<string, string>;
}

export interface CreateReportResponse {
  reportId: string;
}

export interface Report {
  reportId: string;
  reportType: string;
  processingStatus: "CANCELLED" | "DONE" | "FATAL" | "IN_PROGRESS" | "IN_QUEUE";
  createdTime: string;
  reportDocumentId?: string;
  dataStartTime?: string;
  dataEndTime?: string;
  marketplaceIds?: string[];
  reportScheduleId?: string;
  processingStartTime?: string;
  processingEndTime?: string;
}

export interface ReportDocument {
  reportDocumentId: string;
  url: string;
  compressionAlgorithm?: "GZIP";
}

export async function createReport(
  client: SpApiClient,
  params: CreateReportParams,
): Promise<CreateReportResponse> {
  return client.request<CreateReportResponse>({
    operation: "createReport",
    method: "POST",
    path: "/reports/2021-06-30/reports",
    body: {
      reportType: params.reportType,
      marketplaceIds: params.marketplaceIds,
      dataStartTime: params.dataStartTime,
      dataEndTime: params.dataEndTime,
      reportOptions: params.reportOptions,
    },
    rateLimit: CREATE_RATE,
  });
}

export async function getReport(client: SpApiClient, reportId: string): Promise<Report> {
  return client.request<Report>({
    operation: "getReport",
    method: "GET",
    path: `/reports/2021-06-30/reports/${reportId}`,
    rateLimit: GET_RATE,
  });
}

export async function getReportDocument(
  client: SpApiClient,
  reportDocumentId: string,
): Promise<ReportDocument> {
  return client.request<ReportDocument>({
    operation: "getReportDocument",
    method: "GET",
    path: `/reports/2021-06-30/documents/${reportDocumentId}`,
    rateLimit: DOC_RATE,
  });
}

// Common non-PII report types for report_list_types.
export const reportTypes = [
  "GET_MERCHANT_LISTINGS_ALL_DATA",
  "GET_FLAT_FILE_OPEN_LISTINGS_DATA",
  "GET_SALES_AND_TRAFFIC_REPORT",
  "GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT",
  "GET_FBA_INVENTORY_PLANNING_DATA",
] as const;
