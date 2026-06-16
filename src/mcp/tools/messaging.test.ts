// src/mcp/tools/messaging.test.ts
import { describe, it, expect, vi } from "vitest";
import { messagingGetActionsTool, messagingConfirmDeliveryTool } from "./messaging";
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
// messagingGetActionsTool
// ------------------------------------------------------------------

describe("messagingGetActionsTool", () => {
  it("returns available messaging actions on success", async () => {
    const client = mockClient({
      _embedded: { actions: [{ _links: { schema: { href: "/messaging/v1/orders/114-1234567-1234567/messageSchema" } } }] },
    });
    const result = await messagingGetActionsTool(client, config, { amazonOrderId });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("_embedded");
  });

  it("defaults marketplaceIds to config", async () => {
    const client = mockClient({});
    await messagingGetActionsTool(client, config, { amazonOrderId });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
    expect(opts.query.MarketplaceIds).toBeUndefined();
  });

  it("GETs the correct path", async () => {
    const client = mockClient({});
    await messagingGetActionsTool(client, config, { amazonOrderId });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe(`/messaging/v1/orders/${amazonOrderId}`);
  });

  it("returns errorResult on failure", async () => {
    const result = await messagingGetActionsTool(errorClient(), config, { amazonOrderId });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});

// ------------------------------------------------------------------
// messagingConfirmDeliveryTool
// ------------------------------------------------------------------

describe("messagingConfirmDeliveryTool", () => {
  it("returns success on message sent", async () => {
    const client = mockClient({});
    const result = await messagingConfirmDeliveryTool(client, config, {
      amazonOrderId,
      text: "Your order has been delivered.",
    });
    expect(result.isError).toBeUndefined();
  });

  it("POSTs to the correct path with camelCase marketplaceIds query param", async () => {
    const client = mockClient({});
    await messagingConfirmDeliveryTool(client, config, {
      amazonOrderId,
      text: "Your order has been delivered.",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.path).toBe(
      `/messaging/v1/orders/${amazonOrderId}/messages/confirmDeliveryDetails`,
    );
    expect(opts.method).toBe("POST");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
    expect(opts.query.MarketplaceIds).toBeUndefined();
  });

  it("sends text in the request body", async () => {
    const client = mockClient({});
    await messagingConfirmDeliveryTool(client, config, {
      amazonOrderId,
      text: "Your order has been delivered.",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect((opts.body as Record<string, unknown>).text).toBe("Your order has been delivered.");
  });

  it("returns errorResult on failure", async () => {
    const result = await messagingConfirmDeliveryTool(errorClient(), config, {
      amazonOrderId,
      text: "Delivered.",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Error:");
  });
});
