// src/operations/listings.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SpApiClient } from "../client";
import { getListingsItem, putListingsItem, patchListingsItem, deleteListingsItem } from "./listings";

function makeClient(returnValue: unknown) {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as SpApiClient;
}

const SELLER = "A1B2C3SELLER";
const SKU = "MY-SKU-001";
const MKT = ["ATVPDKIKX0DER"];

describe("getListingsItem", () => {
  it("calls correct operation, method, path and query", async () => {
    const client = makeClient({ sku: SKU, summaries: [] });
    await getListingsItem(client, { sellerId: SELLER, sku: SKU, marketplaceIds: MKT });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getListingsItem");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe(`/listings/2021-08-01/items/${SELLER}/${SKU}`);
    expect(opts.query.marketplaceIds).toEqual(MKT);
  });

  it("passes optional includedData", async () => {
    const client = makeClient({ sku: SKU });
    await getListingsItem(client, {
      sellerId: SELLER,
      sku: SKU,
      marketplaceIds: MKT,
      includedData: ["summaries"],
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.includedData).toEqual(["summaries"]);
  });
});

describe("putListingsItem", () => {
  it("calls correct operation, method, path and sends body", async () => {
    const client = makeClient({ status: "ACCEPTED", submissionId: "s1", issues: [] });
    const body = {
      productType: "SHIRT",
      requirements: "LISTING",
      attributes: { item_name: [{ value: "Cool Shirt" }] },
    };
    await putListingsItem(client, { sellerId: SELLER, sku: SKU, marketplaceIds: MKT, body });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("putListingsItem");
    expect(opts.method).toBe("PUT");
    expect(opts.path).toBe(`/listings/2021-08-01/items/${SELLER}/${SKU}`);
    expect(opts.query.marketplaceIds).toEqual(MKT);
    expect(opts.body).toEqual(body);
  });
});

describe("patchListingsItem", () => {
  it("calls correct operation, method, path and sends body", async () => {
    const client = makeClient({ status: "ACCEPTED", submissionId: "s2", issues: [] });
    const body = {
      productType: "SHIRT",
      patches: [{ op: "replace", path: "/attributes/item_name", value: [{ value: "New Name" }] }],
    };
    await patchListingsItem(client, { sellerId: SELLER, sku: SKU, marketplaceIds: MKT, body });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("patchListingsItem");
    expect(opts.method).toBe("PATCH");
    expect(opts.path).toBe(`/listings/2021-08-01/items/${SELLER}/${SKU}`);
    expect(opts.query.marketplaceIds).toEqual(MKT);
    expect(opts.body).toEqual(body);
  });
});

describe("deleteListingsItem", () => {
  it("calls correct operation, method, path and query", async () => {
    const client = makeClient({ status: "ACCEPTED", submissionId: "s3", issues: [] });
    await deleteListingsItem(client, { sellerId: SELLER, sku: SKU, marketplaceIds: MKT });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("deleteListingsItem");
    expect(opts.method).toBe("DELETE");
    expect(opts.path).toBe(`/listings/2021-08-01/items/${SELLER}/${SKU}`);
    expect(opts.query.marketplaceIds).toEqual(MKT);
    expect(opts.body).toBeUndefined();
  });
});
