// src/mcp/tools/listings.test.ts
import { describe, it, expect, vi } from "vitest";
import { listingGetTool, listingPutTool, listingPatchTool, listingDeleteTool } from "./listings";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";

const config: SpApiConfig = {
  lwaClientId: "id",
  lwaClientSecret: "secret",
  refreshToken: "rt",
  region: "na",
  marketplaceIds: ["ATVPDKIKX0DER"],
  sandbox: true,
};

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
