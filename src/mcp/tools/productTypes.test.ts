// src/mcp/tools/productTypes.test.ts
import { describe, it, expect, vi } from "vitest";
import { productTypeGetSchemaTool } from "./productTypes";
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
