// src/operations/messaging.test.ts
import { describe, it, expect, vi } from "vitest";
import { getMessagingActionsForOrder, createConfirmDeliveryDetails } from "./messaging";
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
// getMessagingActionsForOrder
// ------------------------------------------------------------------

describe("getMessagingActionsForOrder", () => {
  it("GETs /messaging/v1/orders/{amazonOrderId}", async () => {
    const client = mockClient({ _links: {}, _embedded: {} });
    await getMessagingActionsForOrder(client, { amazonOrderId, marketplaceIds });
    const opts = callOpts(client);
    expect(opts.operation).toBe("getMessagingActionsForOrder");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe(`/messaging/v1/orders/${amazonOrderId}`);
  });

  it("uses camelCase marketplaceIds query param", async () => {
    const client = mockClient({});
    await getMessagingActionsForOrder(client, { amazonOrderId, marketplaceIds });
    const opts = callOpts(client);
    expect(opts.query.marketplaceIds).toEqual(marketplaceIds);
    // Confirm PascalCase variant is NOT used
    expect(opts.query.MarketplaceIds).toBeUndefined();
  });

  it("does NOT set restrictedResources (Messaging API is not restricted per SP-API Tokens use-case guide)", async () => {
    const client = mockClient({});
    await getMessagingActionsForOrder(client, { amazonOrderId, marketplaceIds });
    const opts = callOpts(client);
    expect(opts.restrictedResources).toBeUndefined();
  });
});

// ------------------------------------------------------------------
// createConfirmDeliveryDetails
// ------------------------------------------------------------------

describe("createConfirmDeliveryDetails", () => {
  it("POSTs to /messaging/v1/orders/{amazonOrderId}/messages/confirmDeliveryDetails", async () => {
    const client = mockClient({});
    await createConfirmDeliveryDetails(client, {
      amazonOrderId,
      marketplaceIds,
      text: "Your order has been delivered.",
    });
    const opts = callOpts(client);
    expect(opts.operation).toBe("createConfirmDeliveryDetails");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe(
      `/messaging/v1/orders/${amazonOrderId}/messages/confirmDeliveryDetails`,
    );
  });

  it("sends text in the body and marketplaceIds as camelCase query param", async () => {
    const client = mockClient({});
    await createConfirmDeliveryDetails(client, {
      amazonOrderId,
      marketplaceIds,
      text: "Your order has been delivered.",
    });
    const opts = callOpts(client);
    expect((opts.body as Record<string, unknown>).text).toBe("Your order has been delivered.");
    expect(opts.query.marketplaceIds).toEqual(marketplaceIds);
    expect(opts.query.MarketplaceIds).toBeUndefined();
  });

  it("does NOT set restrictedResources (Messaging API is not restricted per SP-API Tokens use-case guide)", async () => {
    const client = mockClient({});
    await createConfirmDeliveryDetails(client, {
      amazonOrderId,
      marketplaceIds,
      text: "Your order has been delivered.",
    });
    const opts = callOpts(client);
    expect(opts.restrictedResources).toBeUndefined();
  });
});
