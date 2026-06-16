// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import {
  connectionStatusTool,
  sellersGetMarketplacesTool,
  catalogSearchTool,
  catalogGetItemTool,
  listingGetTool,
  listingPutTool,
  listingPatchTool,
  listingDeleteTool,
  productTypeGetSchemaTool,
  inventoryGetFbaTool,
  pricingGetCompetitiveTool,
  pricingGetItemOffersTool,
  feesEstimateTool,
} from "./tools";

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

  server.registerTool(
    "catalog_search",
    {
      description:
        "Search the Amazon catalog for items by keyword or identifier. Returns item metadata. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        keywords: z.array(z.string()).optional().describe("Search keywords"),
        identifiers: z
          .array(z.string())
          .optional()
          .describe("Product identifiers (ASIN, UPC, EAN, etc.)"),
        identifiersType: z
          .string()
          .optional()
          .describe("Type of identifiers: ASIN, EAN, GTIN, ISBN, JAN, MINSAN, SKU, UPC"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        includedData: z
          .array(z.string())
          .optional()
          .describe("Data sets to include: summaries, images, attributes, etc."),
        brandNames: z.array(z.string()).optional().describe("Filter by brand names"),
        classificationIds: z
          .array(z.string())
          .optional()
          .describe("Filter by classification IDs"),
        pageSize: z.number().int().optional().describe("Number of results per page (max 20)"),
        pageToken: z.string().optional().describe("Token for pagination"),
      },
    },
    async (args) => catalogSearchTool(client, config, args),
  );

  server.registerTool(
    "catalog_get_item",
    {
      description:
        "Get detailed catalog information for a specific Amazon item by ASIN. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        asin: z.string().describe("The Amazon Standard Identification Number (ASIN)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        includedData: z
          .array(z.string())
          .optional()
          .describe("Data sets to include: summaries, images, attributes, productTypes, etc."),
        locale: z.string().optional().describe("Locale for localized attributes (e.g. en_US)"),
      },
    },
    async (args) => catalogGetItemTool(client, config, args),
  );

  const listingCommonInputs = {
    sku: z.string().describe("Seller SKU for the listing"),
    sellerId: z
      .string()
      .optional()
      .describe("Seller ID (defaults to SPAPI_SELLER_ID; required if not configured)"),
    marketplaceIds: z
      .array(z.string())
      .optional()
      .describe("Marketplace IDs (defaults to configured marketplaces)"),
    issueLocale: z.string().optional().describe("Locale for issue messages (e.g. en_US)"),
  };

  server.registerTool(
    "listing_get",
    {
      description:
        "Get a listings item for a seller by SKU. sellerId defaults to SPAPI_SELLER_ID.",
      inputSchema: {
        ...listingCommonInputs,
        includedData: z
          .array(z.string())
          .optional()
          .describe("Data sets to include: summaries, attributes, issues, offers, etc."),
      },
    },
    async (args) => listingGetTool(client, config, args),
  );

  server.registerTool(
    "listing_put",
    {
      description:
        "Create or fully replace a listings item for a seller by SKU. sellerId defaults to SPAPI_SELLER_ID.",
      inputSchema: {
        ...listingCommonInputs,
        body: z
          .object({
            productType: z.string().describe("Amazon product type (e.g. SHIRT)"),
            requirements: z.string().optional().describe("Requirements type (e.g. LISTING)"),
            attributes: z.record(z.unknown()).describe("Product attributes per product type schema"),
          })
          .describe("Listing item body"),
        includedData: z.array(z.string()).optional().describe("Data sets to include in response"),
        mode: z.string().optional().describe("Validation mode (e.g. VALIDATION_PREVIEW)"),
      },
    },
    async (args) => listingPutTool(client, config, args),
  );

  server.registerTool(
    "listing_patch",
    {
      description:
        "Partially update a listings item for a seller by SKU. sellerId defaults to SPAPI_SELLER_ID.",
      inputSchema: {
        ...listingCommonInputs,
        body: z
          .object({
            productType: z.string().describe("Amazon product type (e.g. SHIRT)"),
            patches: z
              .array(
                z.object({
                  op: z.string().describe("JSON Patch operation: add, replace, or delete"),
                  path: z.string().describe("JSON Pointer path to the attribute"),
                  value: z.unknown().optional().describe("Value for add/replace operations"),
                }),
              )
              .describe("Array of JSON Patch operations"),
          })
          .describe("Patch body"),
        includedData: z.array(z.string()).optional().describe("Data sets to include in response"),
        mode: z.string().optional().describe("Validation mode (e.g. VALIDATION_PREVIEW)"),
      },
    },
    async (args) => listingPatchTool(client, config, args),
  );

  server.registerTool(
    "listing_delete",
    {
      description:
        "Delete a listings item for a seller by SKU. sellerId defaults to SPAPI_SELLER_ID.",
      inputSchema: listingCommonInputs,
    },
    async (args) => listingDeleteTool(client, config, args),
  );

  server.registerTool(
    "product_type_get_schema",
    {
      description:
        "Get the JSON schema for an Amazon product type (e.g. SHIRT, LUGGAGE). Used to understand what attributes are required/allowed when creating or updating listings. marketplaceIds defaults to configured marketplaces.",
      inputSchema: {
        productType: z
          .string()
          .describe("Amazon product type name (e.g. SHIRT, LUGGAGE, BACKPACK)"),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
        requirements: z
          .string()
          .optional()
          .describe(
            "Requirements type: LISTING, LISTING_PRODUCT_ONLY, or LISTING_OFFER_ONLY",
          ),
        locale: z.string().optional().describe("Locale for localized display labels (e.g. en_US)"),
      },
    },
    async (args) => productTypeGetSchemaTool(client, config, args),
  );

  server.registerTool(
    "inventory_get_fba",
    {
      description:
        "Get FBA inventory summaries for the seller. Defaults to the first configured marketplace with details=true. Supports pagination via nextToken.",
      inputSchema: {
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
        details: z
          .boolean()
          .optional()
          .describe("Whether to include detailed inventory data (default true)"),
        startDateTime: z
          .string()
          .optional()
          .describe("ISO 8601 datetime to filter items changed after this time"),
        sellerSkus: z
          .array(z.string())
          .optional()
          .describe("Filter by specific seller SKUs"),
        nextToken: z.string().optional().describe("Pagination token from a previous response"),
      },
    },
    async (args) => inventoryGetFbaTool(client, config, args),
  );

  server.registerTool(
    "pricing_get_competitive",
    {
      description:
        "Get competitive pricing for items by ASIN or SKU. Provide either asins or skus (not both). marketplaceId defaults to the first configured marketplace.",
      inputSchema: {
        asins: z
          .array(z.string())
          .optional()
          .describe("List of ASINs to get competitive pricing for (up to 20)"),
        skus: z
          .array(z.string())
          .optional()
          .describe("List of seller SKUs to get competitive pricing for (up to 20)"),
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
      },
    },
    async (args) => pricingGetCompetitiveTool(client, config, args),
  );

  server.registerTool(
    "pricing_get_item_offers",
    {
      description:
        "Get the lowest priced offers for an item by ASIN. marketplaceId defaults to the first configured marketplace.",
      inputSchema: {
        asin: z.string().describe("The ASIN to get offers for"),
        itemCondition: z
          .string()
          .optional()
          .describe("Item condition: New, Used, Collectible, Refurbished, Club (default New)"),
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
        customerType: z
          .string()
          .optional()
          .describe("Customer type for pricing: Consumer or Business"),
      },
    },
    async (args) => pricingGetItemOffersTool(client, config, args),
  );

  server.registerTool(
    "fees_estimate",
    {
      description:
        "Estimate Amazon selling fees for an ASIN at a given price. marketplaceId defaults to the first configured marketplace.",
      inputSchema: {
        asin: z.string().describe("The ASIN to estimate fees for"),
        price: z.number().describe("The listing price to estimate fees on"),
        currencyCode: z
          .string()
          .optional()
          .describe("ISO 4217 currency code (default USD)"),
        isAmazonFulfilled: z
          .boolean()
          .optional()
          .describe("Whether the item is fulfilled by Amazon (default true)"),
        marketplaceId: z
          .string()
          .optional()
          .describe("Marketplace ID (defaults to first configured marketplace)"),
      },
    },
    async (args) => feesEstimateTool(client, config, args),
  );

  return server;
}
