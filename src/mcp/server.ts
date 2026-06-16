// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import { registerAccountTools } from "./tools/account";
import { registerCatalogTools } from "./tools/catalog";
import { registerListingsTools } from "./tools/listings";
import { registerProductTypesTools } from "./tools/productTypes";
import { registerFbaInventoryTools } from "./tools/fbaInventory";
import { registerPricingTools } from "./tools/pricing";
import { registerFeesTools } from "./tools/fees";

export function buildServer(client: SpApiClient, config: SpApiConfig): McpServer {
  const server = new McpServer({ name: "amazon-seller-mcp", version: "0.1.0" });

  registerAccountTools(server, client, config);
  registerCatalogTools(server, client, config);
  registerListingsTools(server, client, config);
  registerProductTypesTools(server, client, config);
  registerFbaInventoryTools(server, client, config);
  registerPricingTools(server, client, config);
  registerFeesTools(server, client, config);

  return server;
}
