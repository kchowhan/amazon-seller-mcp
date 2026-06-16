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
