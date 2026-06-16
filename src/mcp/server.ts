// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import { connectionStatusTool, sellersGetMarketplacesTool } from "./tools";

export function buildServer(client: SpApiClient, config: SpApiConfig): McpServer {
  const server = new McpServer({ name: "amazon-seller-mcp", version: "0.1.0" });

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

  return server;
}
