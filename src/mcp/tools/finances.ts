// src/mcp/tools/finances.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import { listFinancialEvents } from "../../operations/finances";
import { textResult, errorResult, type ToolResult } from "../toolResult";

export async function financeListEventsTool(
  client: SpApiClient,
  _config: SpApiConfig,
  args: {
    postedAfter?: string;
    postedBefore?: string;
    maxResultsPerPage?: number;
    nextToken?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await listFinancialEvents(client, {
      PostedAfter: args.postedAfter,
      PostedBefore: args.postedBefore,
      MaxResultsPerPage: args.maxResultsPerPage ?? 100,
      NextToken: args.nextToken,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export function registerFinancesTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "finance_list_events",
    {
      description:
        "List Amazon financial events (shipments, refunds, adjustments, etc.). Supports pagination via nextToken. Returns up to maxResultsPerPage events per call.",
      inputSchema: {
        postedAfter: z
          .string()
          .optional()
          .describe("ISO 8601 datetime; return events posted at or after this date"),
        postedBefore: z
          .string()
          .optional()
          .describe("ISO 8601 datetime; return events posted before this date"),
        maxResultsPerPage: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results per page (default 100, max 100)"),
        nextToken: z
          .string()
          .optional()
          .describe("Pagination token from a previous response"),
      },
    },
    async (args) => financeListEventsTool(client, config, args),
  );
}
