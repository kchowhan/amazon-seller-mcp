// src/mcp/tools/reports.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import type { FetchLike } from "../../auth/lwaTokenClient";
import { createReport, getReport, getReportDocument, reportTypes } from "../../operations/reports";
import { downloadDocument } from "../../operations/documents";
import { textResult, errorResult, type ToolResult } from "../toolResult";

const MAX_CONTENT_CHARS = 50_000;

export async function reportRequestTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    reportType: string;
    marketplaceIds?: string[];
    dataStartTime?: string;
    dataEndTime?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await createReport(client, {
      reportType: args.reportType,
      marketplaceIds: args.marketplaceIds ?? config.marketplaceIds,
      dataStartTime: args.dataStartTime,
      dataEndTime: args.dataEndTime,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function reportGetDocumentTool(
  client: SpApiClient,
  args: { reportId: string },
  fetchFn: FetchLike = fetch,
): Promise<ToolResult> {
  try {
    const report = await getReport(client, args.reportId);
    if (report.processingStatus !== "DONE") {
      return textResult({ processingStatus: report.processingStatus, reportId: report.reportId });
    }
    if (!report.reportDocumentId) {
      return textResult({ processingStatus: "DONE", reportId: report.reportId, reportDocumentId: null });
    }
    const doc = await getReportDocument(client, report.reportDocumentId);
    const content = await downloadDocument(doc.url, doc.compressionAlgorithm, fetchFn);
    const truncated = content.length > MAX_CONTENT_CHARS;
    return textResult({
      reportId: report.reportId,
      reportDocumentId: report.reportDocumentId,
      truncated,
      content: truncated ? content.slice(0, MAX_CONTENT_CHARS) + "\n[truncated]" : content,
    });
  } catch (err) {
    return errorResult(err);
  }
}

export function reportListTypesTool(): ToolResult {
  return textResult(reportTypes);
}

export function registerReportsTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "report_request",
    {
      description:
        "Request an Amazon seller report. Returns a reportId to poll with report_get_document. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        reportType: z
          .string()
          .describe("Report type identifier (e.g. GET_MERCHANT_LISTINGS_ALL_DATA)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        dataStartTime: z
          .string()
          .optional()
          .describe("ISO 8601 start time for the report data range"),
        dataEndTime: z
          .string()
          .optional()
          .describe("ISO 8601 end time for the report data range"),
      },
    },
    async (args) => reportRequestTool(client, config, args),
  );

  server.registerTool(
    "report_get_document",
    {
      description:
        "Check the status of a requested report and, when DONE, download and return its content (first 50k chars). Returns processingStatus if not yet complete.",
      inputSchema: {
        reportId: z.string().describe("The reportId returned by report_request"),
      },
    },
    async (args) => reportGetDocumentTool(client, args),
  );

  server.registerTool(
    "report_list_types",
    {
      description: "List the available non-PII Amazon report types.",
      inputSchema: {},
    },
    async () => reportListTypesTool(),
  );
}
