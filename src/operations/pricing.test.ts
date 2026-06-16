// src/operations/pricing.test.ts
// Product Pricing API v0
// Model: product-pricing-api-model/productPricingV0.json
// Note: this API uses PascalCase query params (MarketplaceId, Asins, Skus, ItemType, ItemCondition)
import { describe, it, expect, vi } from "vitest";
import type { SpApiClient } from "../client";
import { getCompetitivePricing, getItemOffers } from "./pricing";

function makeClient(returnValue: unknown) {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as SpApiClient;
}

describe("getCompetitivePricing", () => {
  it("calls correct operation, method, path with PascalCase query params (ASINs)", async () => {
    const client = makeClient({ payload: [] });
    await getCompetitivePricing(client, {
      MarketplaceId: "ATVPDKIKX0DER",
      Asins: ["B001234567"],
      ItemType: "Asin",
    });

    expect(client.request).toHaveBeenCalledOnce();
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getCompetitivePricing");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/products/pricing/v0/competitivePrice");
    expect(opts.query.MarketplaceId).toBe("ATVPDKIKX0DER");
    expect(opts.query.Asins).toEqual(["B001234567"]);
    expect(opts.query.ItemType).toBe("Asin");
  });

  it("passes Skus and ItemType=Sku when skus provided", async () => {
    const client = makeClient({ payload: [] });
    await getCompetitivePricing(client, {
      MarketplaceId: "ATVPDKIKX0DER",
      Skus: ["MY-SKU-1"],
      ItemType: "Sku",
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.Skus).toEqual(["MY-SKU-1"]);
    expect(opts.query.ItemType).toBe("Sku");
  });
});

describe("getItemOffers", () => {
  it("calls correct operation, method, path with PascalCase query params", async () => {
    const client = makeClient({ payload: { ASIN: "B001234567", status: "Success", Offers: [] } });
    await getItemOffers(client, {
      Asin: "B001234567",
      MarketplaceId: "ATVPDKIKX0DER",
      ItemCondition: "New",
    });

    expect(client.request).toHaveBeenCalledOnce();
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getItemOffers");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/products/pricing/v0/items/B001234567/offers");
    expect(opts.query.MarketplaceId).toBe("ATVPDKIKX0DER");
    expect(opts.query.ItemCondition).toBe("New");
  });

  it("passes optional CustomerType when supplied", async () => {
    const client = makeClient({ payload: {} });
    await getItemOffers(client, {
      Asin: "B001234567",
      MarketplaceId: "ATVPDKIKX0DER",
      ItemCondition: "Used",
      CustomerType: "Consumer",
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.CustomerType).toBe("Consumer");
    expect(opts.query.ItemCondition).toBe("Used");
  });
});
