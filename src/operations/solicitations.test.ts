// src/operations/solicitations.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  getSolicitationActionsForOrder,
  createProductReviewAndSellerFeedbackSolicitation,
} from "./solicitations";
import type { SpApiClient } from "../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

function callOpts(client: SpApiClient) {
  return (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
}

const amazonOrderId = "114-1234567-1234567";
const marketplaceIds = ["ATVPDKIKX0DER"];

// ------------------------------------------------------------------
// getSolicitationActionsForOrder
// ------------------------------------------------------------------

describe("getSolicitationActionsForOrder", () => {
  it("GETs /solicitations/v1/orders/{amazonOrderId}", async () => {
    const client = mockClient({ _links: {}, _embedded: {} });
    await getSolicitationActionsForOrder(client, { amazonOrderId, marketplaceIds });
    const opts = callOpts(client);
    expect(opts.operation).toBe("getSolicitationActionsForOrder");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe(`/solicitations/v1/orders/${amazonOrderId}`);
  });

  it("uses camelCase marketplaceIds query param", async () => {
    const client = mockClient({});
    await getSolicitationActionsForOrder(client, { amazonOrderId, marketplaceIds });
    const opts = callOpts(client);
    expect(opts.query.marketplaceIds).toEqual(marketplaceIds);
    expect(opts.query.MarketplaceIds).toBeUndefined();
  });

  it("does NOT set restrictedResources (Solicitations API is not restricted per SP-API Tokens use-case guide)", async () => {
    const client = mockClient({});
    await getSolicitationActionsForOrder(client, { amazonOrderId, marketplaceIds });
    const opts = callOpts(client);
    expect(opts.restrictedResources).toBeUndefined();
  });
});

// ------------------------------------------------------------------
// createProductReviewAndSellerFeedbackSolicitation
// ------------------------------------------------------------------

describe("createProductReviewAndSellerFeedbackSolicitation", () => {
  it("POSTs to /solicitations/v1/orders/{amazonOrderId}/solicitations/productReviewAndSellerFeedback", async () => {
    const client = mockClient({});
    await createProductReviewAndSellerFeedbackSolicitation(client, {
      amazonOrderId,
      marketplaceIds,
    });
    const opts = callOpts(client);
    expect(opts.operation).toBe("createProductReviewAndSellerFeedbackSolicitation");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe(
      `/solicitations/v1/orders/${amazonOrderId}/solicitations/productReviewAndSellerFeedback`,
    );
  });

  it("uses camelCase marketplaceIds query param and sends no body", async () => {
    const client = mockClient({});
    await createProductReviewAndSellerFeedbackSolicitation(client, {
      amazonOrderId,
      marketplaceIds,
    });
    const opts = callOpts(client);
    expect(opts.query.marketplaceIds).toEqual(marketplaceIds);
    expect(opts.query.MarketplaceIds).toBeUndefined();
    // POST endpoint has no request body per solicitations.json
    expect(opts.body).toBeUndefined();
  });

  it("does NOT set restrictedResources (Solicitations API is not restricted per SP-API Tokens use-case guide)", async () => {
    const client = mockClient({});
    await createProductReviewAndSellerFeedbackSolicitation(client, {
      amazonOrderId,
      marketplaceIds,
    });
    const opts = callOpts(client);
    expect(opts.restrictedResources).toBeUndefined();
  });
});
