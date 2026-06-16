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
import { registerReportsTools } from "./tools/reports";
import { registerFeedsTools } from "./tools/feeds";
import { registerFinancesTools } from "./tools/finances";
import { registerSalesTools } from "./tools/sales";
import { registerNotificationsTools } from "./tools/notifications";
import { registerOrdersTools } from "./tools/orders";
import { registerMerchantFulfillmentTools } from "./tools/merchantFulfillment";
import { registerMessagingTools } from "./tools/messaging";
import { registerSolicitationsTools } from "./tools/solicitations";
import { registerAlertsTools } from "./tools/alerts";
import { InMemoryEventStore, type EventStore } from "../notifications/eventStore";

export function buildServer(
  client: SpApiClient,
  config: SpApiConfig,
  eventStore: EventStore = new InMemoryEventStore(),
  mcpUserId = "default",
): McpServer {
  const server = new McpServer({ name: "amazon-seller-mcp", version: "0.1.0" });

  registerAccountTools(server, client, config);
  registerCatalogTools(server, client, config);
  registerListingsTools(server, client, config);
  registerProductTypesTools(server, client, config);
  registerFbaInventoryTools(server, client, config);
  registerPricingTools(server, client, config);
  registerFeesTools(server, client, config);
  registerReportsTools(server, client, config);
  registerFeedsTools(server, client, config);
  registerFinancesTools(server, client, config);
  registerSalesTools(server, client, config);
  registerNotificationsTools(server, client, config);
  registerOrdersTools(server, client, config);
  registerMerchantFulfillmentTools(server, client);
  registerMessagingTools(server, client, config);
  registerSolicitationsTools(server, client, config);
  registerAlertsTools(server, eventStore, mcpUserId);

  return server;
}
