// src/mcp/tools/alerts.ts
// recent_alerts tool: returns the most recent SP-API notification events for the
// current seller, delivered via SQS and stored in the shared EventStore.
// In stdio/single-tenant mode the store starts empty; the tool returns [] cleanly.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EventStore } from "../../notifications/eventStore.js";
import { textResult, type ToolResult } from "../toolResult.js";

export async function recentAlertsTool(
  store: EventStore,
  mcpUserId: string,
  limit: number,
): Promise<ToolResult> {
  const events = store.recent(mcpUserId, limit);
  return textResult(events);
}

export function registerAlertsTools(
  server: McpServer,
  store: EventStore,
  mcpUserId: string,
): void {
  server.registerTool(
    "recent_alerts",
    {
      description:
        "Return the most recent SP-API notification events received for this seller " +
        "(e.g. ORDER_CHANGE, ANY_OFFER_CHANGED, REPORT_PROCESSING_FINISHED). " +
        "Events are delivered from SQS and stored in-memory. Returns an empty list " +
        "if no notifications have been received since startup.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum number of events to return (default: 20)"),
      },
    },
    async (args) => recentAlertsTool(store, mcpUserId, args.limit ?? 20),
  );
}
