// src/mcp/tools.test.ts
import { describe, it, expect, vi } from "vitest";
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
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";
import { SpApiError } from "../errors";

const config: SpApiConfig = {
  lwaClientId: "id",
  lwaClientSecret: "secret",
  refreshToken: "rt",
  region: "na",
  marketplaceIds: ["ATVPDKIKX0DER"],
  sandbox: true,
};

describe("connectionStatusTool", () => {
  it("returns the configured region, sandbox flag, and marketplaces as text", async () => {
    const result = await connectionStatusTool(config);
    const text = result.content[0]!.text;
    expect(text).toContain("\"region\": \"na\"");
    expect(text).toContain("\"sandbox\": true");
    expect(text).toContain("ATVPDKIKX0DER");
  });
});

describe("sellersGetMarketplacesTool", () => {
  it("serializes the marketplace participations from the client", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: [
        {
          marketplace: { id: "ATVPDKIKX0DER", name: "Amazon.com", countryCode: "US" },
          participation: { isParticipating: true, hasSuspendedListings: false },
        },
      ],
    });
    const client = { request } as unknown as SpApiClient;

    const result = await sellersGetMarketplacesTool(client);
    expect(result.content[0]!.text).toContain("Amazon.com");
  });

  it("returns isError and a body-free message when the client rejects with SpApiError", async () => {
    const request = vi.fn().mockRejectedValue(
      new SpApiError(
        "SP-API getMarketplaceParticipations failed with status 403",
        403,
        undefined,
        false,
        "<body>",
      ),
    );
    const client = { request } as unknown as SpApiClient;

    const result = await sellersGetMarketplacesTool(client);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/^Error:/);
    expect(result.content[0]!.text).not.toContain("<body>");
  });
});

describe("catalogSearchTool", () => {
  it("returns search results as text", async () => {
    const request = vi.fn().mockResolvedValue({ items: [{ asin: "B001" }], numberOfResults: 1 });
    const client = { request } as unknown as SpApiClient;

    const result = await catalogSearchTool(client, config, { keywords: ["laptop"] });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("B001");
  });

  it("uses config marketplaceIds when caller omits them", async () => {
    const request = vi.fn().mockResolvedValue({ items: [], numberOfResults: 0 });
    const client = { request } as unknown as SpApiClient;

    await catalogSearchTool(client, config, { keywords: ["test"] });
    const opts = request.mock.calls[0]![0];
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("network error"));
    const client = { request } as unknown as SpApiClient;

    const result = await catalogSearchTool(client, config, { keywords: ["test"] });
    expect(result.isError).toBe(true);
  });
});

describe("catalogGetItemTool", () => {
  it("returns catalog item as text", async () => {
    const request = vi.fn().mockResolvedValue({ asin: "B001234567", summaries: [] });
    const client = { request } as unknown as SpApiClient;

    const result = await catalogGetItemTool(client, config, { asin: "B001234567" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("B001234567");
  });

  it("uses config marketplaceIds when caller omits them", async () => {
    const request = vi.fn().mockResolvedValue({ asin: "B001234567" });
    const client = { request } as unknown as SpApiClient;

    await catalogGetItemTool(client, config, { asin: "B001234567" });
    const opts = request.mock.calls[0]![0];
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("not found"));
    const client = { request } as unknown as SpApiClient;

    const result = await catalogGetItemTool(client, config, { asin: "X" });
    expect(result.isError).toBe(true);
  });
});

const configWithSeller: SpApiConfig = { ...config, sellerId: "A1SELLER" };
const SKU = "TEST-SKU";
const MKT = ["ATVPDKIKX0DER"];

describe("listingGetTool", () => {
  it("returns listing item on success", async () => {
    const request = vi.fn().mockResolvedValue({ sku: SKU });
    const client = { request } as unknown as SpApiClient;

    const result = await listingGetTool(client, configWithSeller, { sku: SKU });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain(SKU);
  });

  it("returns errorResult with message when sellerId missing from both config and args", async () => {
    const request = vi.fn();
    const client = { request } as unknown as SpApiClient;

    const result = await listingGetTool(client, config, { sku: SKU });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("SPAPI_SELLER_ID");
  });

  it("prefers explicit sellerId arg over config", async () => {
    const request = vi.fn().mockResolvedValue({ sku: SKU });
    const client = { request } as unknown as SpApiClient;

    await listingGetTool(client, configWithSeller, { sku: SKU, sellerId: "EXPLICIT", marketplaceIds: MKT });
    const opts = request.mock.calls[0]![0];
    expect(opts.path).toContain("/EXPLICIT/");
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("403"));
    const client = { request } as unknown as SpApiClient;

    const result = await listingGetTool(client, configWithSeller, { sku: SKU });
    expect(result.isError).toBe(true);
  });
});

describe("listingPutTool", () => {
  it("returns success result", async () => {
    const request = vi.fn().mockResolvedValue({ status: "ACCEPTED", submissionId: "s1", issues: [] });
    const client = { request } as unknown as SpApiClient;

    const body = { productType: "SHIRT", attributes: {} };
    const result = await listingPutTool(client, configWithSeller, { sku: SKU, body });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("ACCEPTED");
  });

  it("returns errorResult when sellerId missing", async () => {
    const request = vi.fn();
    const client = { request } as unknown as SpApiClient;

    const result = await listingPutTool(client, config, { sku: SKU, body: { productType: "X", attributes: {} } });
    expect(result.isError).toBe(true);
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("400"));
    const client = { request } as unknown as SpApiClient;

    const result = await listingPutTool(client, configWithSeller, { sku: SKU, body: { productType: "X", attributes: {} } });
    expect(result.isError).toBe(true);
  });
});

describe("listingPatchTool", () => {
  it("returns success result", async () => {
    const request = vi.fn().mockResolvedValue({ status: "ACCEPTED", submissionId: "s2", issues: [] });
    const client = { request } as unknown as SpApiClient;

    const body = { productType: "SHIRT", patches: [{ op: "replace", path: "/attributes/item_name", value: "X" }] };
    const result = await listingPatchTool(client, configWithSeller, { sku: SKU, body });
    expect(result.isError).toBeUndefined();
  });

  it("returns errorResult when sellerId missing", async () => {
    const request = vi.fn();
    const client = { request } as unknown as SpApiClient;

    const result = await listingPatchTool(client, config, { sku: SKU, body: { productType: "X", patches: [] } });
    expect(result.isError).toBe(true);
  });
});

describe("listingDeleteTool", () => {
  it("returns success result", async () => {
    const request = vi.fn().mockResolvedValue({ status: "ACCEPTED", submissionId: "s3", issues: [] });
    const client = { request } as unknown as SpApiClient;

    const result = await listingDeleteTool(client, configWithSeller, { sku: SKU });
    expect(result.isError).toBeUndefined();
  });

  it("returns errorResult when sellerId missing", async () => {
    const request = vi.fn();
    const client = { request } as unknown as SpApiClient;

    const result = await listingDeleteTool(client, config, { sku: SKU });
    expect(result.isError).toBe(true);
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("404"));
    const client = { request } as unknown as SpApiClient;

    const result = await listingDeleteTool(client, configWithSeller, { sku: SKU });
    expect(result.isError).toBe(true);
  });
});

describe("productTypeGetSchemaTool", () => {
  it("returns product type schema as text", async () => {
    const request = vi.fn().mockResolvedValue({ productType: "SHIRT", schema: { type: "object" } });
    const client = { request } as unknown as SpApiClient;

    const result = await productTypeGetSchemaTool(client, config, { productType: "SHIRT" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("SHIRT");
  });

  it("uses config marketplaceIds when caller omits them", async () => {
    const request = vi.fn().mockResolvedValue({ productType: "SHIRT" });
    const client = { request } as unknown as SpApiClient;

    await productTypeGetSchemaTool(client, config, { productType: "SHIRT" });
    const opts = request.mock.calls[0]![0];
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("not found"));
    const client = { request } as unknown as SpApiClient;

    const result = await productTypeGetSchemaTool(client, config, { productType: "UNKNOWN" });
    expect(result.isError).toBe(true);
  });
});

describe("inventoryGetFbaTool", () => {
  it("returns inventory summaries as text", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: { inventorySummaries: [{ sellerSku: "SKU-1", totalQuantity: 10 }] },
    });
    const client = { request } as unknown as SpApiClient;

    const result = await inventoryGetFbaTool(client, config, {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("SKU-1");
  });

  it("uses config marketplaceId when caller omits marketplaceId", async () => {
    const request = vi.fn().mockResolvedValue({ payload: { inventorySummaries: [] } });
    const client = { request } as unknown as SpApiClient;

    await inventoryGetFbaTool(client, config, {});
    const opts = request.mock.calls[0]![0];
    expect(opts.query.granularityId).toBe("ATVPDKIKX0DER");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
    expect(opts.query.granularityType).toBe("Marketplace");
    expect(opts.query.details).toBe("true");
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("503"));
    const client = { request } as unknown as SpApiClient;

    const result = await inventoryGetFbaTool(client, config, {});
    expect(result.isError).toBe(true);
  });

  it("serializes details=false as the string \"false\" in the query", async () => {
    const request = vi.fn().mockResolvedValue({ payload: { inventorySummaries: [] } });
    const client = { request } as unknown as SpApiClient;

    await inventoryGetFbaTool(client, config, { details: false });
    const opts = request.mock.calls[0]![0];
    expect(opts.query.details).toBe("false");
  });
});

describe("pricingGetCompetitiveTool", () => {
  it("returns competitive pricing as text", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: [{ ASIN: "B001", status: "Success", Product: {} }],
    });
    const client = { request } as unknown as SpApiClient;

    const result = await pricingGetCompetitiveTool(client, config, { asins: ["B001"] });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("B001");
  });

  it("passes PascalCase params and uses config marketplaceId when omitted", async () => {
    const request = vi.fn().mockResolvedValue({ payload: [] });
    const client = { request } as unknown as SpApiClient;

    await pricingGetCompetitiveTool(client, config, { asins: ["B001"] });
    const opts = request.mock.calls[0]![0];
    expect(opts.query.MarketplaceId).toBe("ATVPDKIKX0DER");
    expect(opts.query.Asins).toEqual(["B001"]);
    expect(opts.query.ItemType).toBe("Asin");
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("403"));
    const client = { request } as unknown as SpApiClient;

    const result = await pricingGetCompetitiveTool(client, config, { asins: ["B001"] });
    expect(result.isError).toBe(true);
  });

  it("returns isError when both asins and skus are provided", async () => {
    const request = vi.fn();
    const client = { request } as unknown as SpApiClient;

    const result = await pricingGetCompetitiveTool(client, config, {
      asins: ["B001"],
      skus: ["MY-SKU"],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("not both");
    expect(request).not.toHaveBeenCalled();
  });

  it("returns isError when neither asins nor skus are provided", async () => {
    const request = vi.fn();
    const client = { request } as unknown as SpApiClient;

    const result = await pricingGetCompetitiveTool(client, config, {});
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("provide asins or skus");
    expect(request).not.toHaveBeenCalled();
  });

  it("passes ItemType=Sku and Skus in query when only skus provided", async () => {
    const request = vi.fn().mockResolvedValue({ payload: [] });
    const client = { request } as unknown as SpApiClient;

    const result = await pricingGetCompetitiveTool(client, config, { skus: ["MY-SKU"] });
    expect(result.isError).toBeUndefined();
    const opts = request.mock.calls[0]![0];
    expect(opts.query.ItemType).toBe("Sku");
    expect(opts.query.Skus).toEqual(["MY-SKU"]);
  });
});

describe("pricingGetItemOffersTool", () => {
  it("returns item offers as text", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: { ASIN: "B001", status: "Success", Offers: [] },
    });
    const client = { request } as unknown as SpApiClient;

    const result = await pricingGetItemOffersTool(client, config, { asin: "B001" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("B001");
  });

  it("uses default ItemCondition=New and config marketplaceId when omitted", async () => {
    const request = vi.fn().mockResolvedValue({ payload: {} });
    const client = { request } as unknown as SpApiClient;

    await pricingGetItemOffersTool(client, config, { asin: "B001" });
    const opts = request.mock.calls[0]![0];
    expect(opts.query.MarketplaceId).toBe("ATVPDKIKX0DER");
    expect(opts.query.ItemCondition).toBe("New");
    expect(opts.path).toContain("/B001/");
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("404"));
    const client = { request } as unknown as SpApiClient;

    const result = await pricingGetItemOffersTool(client, config, { asin: "B001" });
    expect(result.isError).toBe(true);
  });
});

describe("feesEstimateTool", () => {
  it("returns fees estimate as text", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: {
        FeesEstimateResult: {
          FeesEstimate: { TotalFeesEstimate: { CurrencyCode: "USD", Amount: 3.5 } },
        },
      },
    });
    const client = { request } as unknown as SpApiClient;

    const result = await feesEstimateTool(client, config, { asin: "B001", price: 29.99 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("USD");
  });

  it("passes correct POST body with PascalCase fields and defaults", async () => {
    const request = vi.fn().mockResolvedValue({ payload: {} });
    const client = { request } as unknown as SpApiClient;

    await feesEstimateTool(client, config, { asin: "B001", price: 29.99 });
    const opts = request.mock.calls[0]![0];
    expect(opts.method).toBe("POST");
    expect(opts.path).toContain("/B001/feesEstimate");
    expect(opts.body.FeesEstimateRequest.MarketplaceId).toBe("ATVPDKIKX0DER");
    expect(opts.body.FeesEstimateRequest.IsAmazonFulfilled).toBe(true);
    expect(opts.body.FeesEstimateRequest.PriceToEstimateFees.ListingPrice.CurrencyCode).toBe("USD");
    expect(opts.body.FeesEstimateRequest.PriceToEstimateFees.ListingPrice.Amount).toBe(29.99);
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("400"));
    const client = { request } as unknown as SpApiClient;

    const result = await feesEstimateTool(client, config, { asin: "B001", price: 9.99 });
    expect(result.isError).toBe(true);
  });
});
