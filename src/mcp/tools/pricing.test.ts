// src/mcp/tools/pricing.test.ts
import { describe, it, expect, vi } from "vitest";
import { pricingGetCompetitiveTool, pricingGetItemOffersTool } from "./pricing";
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
