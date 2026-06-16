// src/mcp/tools/fbaInventory.test.ts
import { describe, it, expect, vi } from "vitest";
import { inventoryGetFbaTool } from "./fbaInventory";
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
