// src/operations/fbaInventory.test.ts
// Model: fba-inventory-api-model/fbaInventory.json
import { describe, it, expect, vi } from "vitest";
import type { SpApiClient } from "../client";
import { getInventorySummaries } from "./fbaInventory";

function makeClient(returnValue: unknown) {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as SpApiClient;
}

describe("getInventorySummaries", () => {
  it("calls correct operation, method, path with required camelCase query params", async () => {
    const client = makeClient({ payload: { inventorySummaries: [] } });
    await getInventorySummaries(client, {
      granularityType: "Marketplace",
      granularityId: "ATVPDKIKX0DER",
      marketplaceIds: ["ATVPDKIKX0DER"],
    });

    expect(client.request).toHaveBeenCalledOnce();
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getInventorySummaries");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/fba/inventory/v1/summaries");
    expect(opts.query.granularityType).toBe("Marketplace");
    expect(opts.query.granularityId).toBe("ATVPDKIKX0DER");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("passes optional details and sellerSkus when supplied", async () => {
    const client = makeClient({ payload: { inventorySummaries: [] } });
    await getInventorySummaries(client, {
      granularityType: "Marketplace",
      granularityId: "ATVPDKIKX0DER",
      marketplaceIds: ["ATVPDKIKX0DER"],
      details: true,
      sellerSkus: ["SKU-1", "SKU-2"],
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.details).toBe("true");
    expect(opts.query.sellerSkus).toEqual(["SKU-1", "SKU-2"]);
  });

  it("passes optional startDateTime and nextToken when supplied", async () => {
    const client = makeClient({ payload: { inventorySummaries: [] } });
    await getInventorySummaries(client, {
      granularityType: "Marketplace",
      granularityId: "ATVPDKIKX0DER",
      marketplaceIds: ["ATVPDKIKX0DER"],
      startDateTime: "2024-01-01T00:00:00Z",
      nextToken: "tok123",
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.startDateTime).toBe("2024-01-01T00:00:00Z");
    expect(opts.query.nextToken).toBe("tok123");
  });
});
