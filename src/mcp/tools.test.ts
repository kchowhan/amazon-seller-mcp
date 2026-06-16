// src/mcp/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  connectionStatusTool,
  sellersGetMarketplacesTool,
  catalogSearchTool,
  catalogGetItemTool,
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
