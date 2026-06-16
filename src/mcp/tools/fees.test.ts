// src/mcp/tools/fees.test.ts
import { describe, it, expect, vi } from "vitest";
import { feesEstimateTool } from "./fees";
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

describe("feesEstimateTool", () => {
  it("returns fees estimate as text", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: {
        FeesEstimateResult: {
          FeesEstimate: { TotalFeesEstimate: { CurrencyCode: "USD", Amount: 3.5 } },
        },
      },
    });
    const client = { request } as unknown as SpApiClient;

    const result = await feesEstimateTool(client, config, { asin: "B001", price: 29.99 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("USD");
  });

  it("passes correct POST body with PascalCase fields and defaults", async () => {
    const request = vi.fn().mockResolvedValue({ payload: {} });
    const client = { request } as unknown as SpApiClient;

    await feesEstimateTool(client, config, { asin: "B001", price: 29.99 });
    const opts = request.mock.calls[0]![0];
    expect(opts.method).toBe("POST");
    expect(opts.path).toContain("/B001/feesEstimate");
    expect(opts.body.FeesEstimateRequest.MarketplaceId).toBe("ATVPDKIKX0DER");
    expect(opts.body.FeesEstimateRequest.IsAmazonFulfilled).toBe(true);
    expect(opts.body.FeesEstimateRequest.PriceToEstimateFees.ListingPrice.CurrencyCode).toBe("USD");
    expect(opts.body.FeesEstimateRequest.PriceToEstimateFees.ListingPrice.Amount).toBe(29.99);
  });

  it("returns isError when request rejects", async () => {
    const request = vi.fn().mockRejectedValue(new Error("400"));
    const client = { request } as unknown as SpApiClient;

    const result = await feesEstimateTool(client, config, { asin: "B001", price: 9.99 });
    expect(result.isError).toBe(true);
  });
});
