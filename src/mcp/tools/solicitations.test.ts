// src/mcp/tools/solicitations.test.ts
import { describe, it, expect, vi } from "vitest";
import { solicitationsGetActionsTool, solicitationsRequestReviewTool } from "./solicitations";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";

const config: SpApiConfig = {
  lwaClientId: "id",
  lwaClientSecret: "secret",
  refreshToken: "rt",
  region: "na",
  marketplaceIds: ["ATVPDKIKX0DER"],
  sandbox: false,
};

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

function errorClient(): SpApiClient {
  return {
    request: vi.fn().mockRejectedValue(new Error("SP-API error")),
  } as unknown as SpApiClient;
}

const amazonOrderId = "114-1234567-1234567";

// ------------------------------------------------------------------
// solicitationsGetActionsTool
// ------------------------------------------------------------------

describe("solicitationsGetActionsTool", () => {
  it("returns solicitation actions on success", async () => {
    const client = mockClient({
      _embedded: { actions: [{ _links: {}, name: "productReviewAndSellerFeedback" }] },
    });
    const result = await solicitationsGetActionsTool(client, config, { amazonOrderId });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("productReviewAndSellerFeedback");
  });

  it("defaults marketplaceIds to config", async () => {
    const client = mockClient({});
    await solicitationsGetActionsTool(client, config, { amazonOrderId });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
    expect(opts.query.MarketplaceIds).toBeUndefined();
  });

  it("GETs the correct path", async () => {
    const client = mockClient({});
    await solicitationsGetActionsTool(client, config, { amazonOrderId });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe(`/solicitations/v1/orders/${amazonOrderId}`);
  });

  it("returns errorResult on failure", async () => {
    const result = await solicitationsGetActionsTool(errorClient(), config, { amazonOrderId });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});

// ------------------------------------------------------------------
// solicitationsRequestReviewTool
// ------------------------------------------------------------------

describe("solicitationsRequestReviewTool", () => {
  it("returns success on solicitation sent", async () => {
    const client = mockClient({});
    const result = await solicitationsRequestReviewTool(client, config, { amazonOrderId });
    expect(result.isError).toBeUndefined();
  });

  it("POSTs to the correct path with camelCase marketplaceIds query param", async () => {
    const client = mockClient({});
    await solicitationsRequestReviewTool(client, config, { amazonOrderId });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe(
      `/solicitations/v1/orders/${amazonOrderId}/solicitations/productReviewAndSellerFeedback`,
    );
    expect(opts.method).toBe("POST");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
    expect(opts.query.MarketplaceIds).toBeUndefined();
  });

  it("sends no request body", async () => {
    const client = mockClient({});
    await solicitationsRequestReviewTool(client, config, { amazonOrderId });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.body).toBeUndefined();
  });

  it("returns errorResult on failure", async () => {
    const result = await solicitationsRequestReviewTool(errorClient(), config, { amazonOrderId });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});
