// src/operations/catalog.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SpApiClient } from "../client";
import { searchCatalogItems, getCatalogItem } from "./catalog";

function makeClient(returnValue: unknown) {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as SpApiClient;
}

describe("searchCatalogItems", () => {
  it("calls the correct operation, method, and path with marketplaceIds and keywords", async () => {
    const client = makeClient({ items: [], numberOfResults: 0 });
    await searchCatalogItems(client, {
      marketplaceIds: ["ATVPDKIKX0DER"],
      keywords: ["laptop"],
    });

    expect(client.request).toHaveBeenCalledOnce();
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("searchCatalogItems");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/catalog/2022-04-01/items");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
    expect(opts.query.keywords).toEqual(["laptop"]);
  });

  it("passes optional includedData and pageSize when supplied", async () => {
    const client = makeClient({ items: [], numberOfResults: 0 });
    await searchCatalogItems(client, {
      marketplaceIds: ["ATVPDKIKX0DER"],
      includedData: ["summaries"],
      pageSize: 10,
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.includedData).toEqual(["summaries"]);
    expect(opts.query.pageSize).toBe(10);
  });
});

describe("getCatalogItem", () => {
  it("calls the correct operation, method, path with asin and marketplaceIds", async () => {
    const client = makeClient({ asin: "B001234567" });
    await getCatalogItem(client, {
      asin: "B001234567",
      marketplaceIds: ["ATVPDKIKX0DER"],
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getCatalogItem");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/catalog/2022-04-01/items/B001234567");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("passes optional includedData when supplied", async () => {
    const client = makeClient({ asin: "B001234567" });
    await getCatalogItem(client, {
      asin: "B001234567",
      marketplaceIds: ["ATVPDKIKX0DER"],
      includedData: ["images", "summaries"],
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.includedData).toEqual(["images", "summaries"]);
  });
});
