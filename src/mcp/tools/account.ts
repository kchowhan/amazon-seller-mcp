// src/mcp/tools/account.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import { getMarketplaceParticipations } from "../../operations/sellers";
import { textResult, errorResult, type ToolResult } from "../toolResult";

export async function connectionStatusTool(config: SpApiConfig): Promise<ToolResult> {
  return textResult({
    region: config.region,
    sandbox: config.sandbox,
    marketplaceIds: config.marketplaceIds,
    note: "Credentials loaded from environment (Phase 0 single-tenant).",
  });
}

export async function sellersGetMarketplacesTool(client: SpApiClient): Promise<ToolResult> {
  try {
    const participations = await getMarketplaceParticipations(client);
    return textResult(participations);
  } catch (err) {
    return errorResult(err);
  }
}

export function registerAccountTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "connection_status",
    {
      description:
        "Show which Amazon seller account context is configured (region, sandbox, marketplaces).",
    },
    async () => connectionStatusTool(config),
  );

  server.registerTool(
    "sellers_get_marketplaces",
    {
      description: "List the Amazon marketplaces this seller participates in.",
    },
    async () => sellersGetMarketplacesTool(client),
  );
}
