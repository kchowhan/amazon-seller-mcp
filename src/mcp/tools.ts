// src/mcp/tools.ts
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import { getMarketplaceParticipations } from "../operations/sellers";

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
}

function textResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export async function connectionStatusTool(config: SpApiConfig): Promise<ToolResult> {
  return textResult({
    region: config.region,
    sandbox: config.sandbox,
    marketplaceIds: config.marketplaceIds,
    note: "Credentials loaded from environment (Phase 0 single-tenant).",
  });
}

export async function sellersGetMarketplacesTool(client: SpApiClient): Promise<ToolResult> {
  const participations = await getMarketplaceParticipations(client);
  return textResult(participations);
}
