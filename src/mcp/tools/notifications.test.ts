// src/mcp/tools/notifications.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  notificationsCreateDestinationTool,
  notificationsListDestinationsTool,
  notificationsDeleteDestinationTool,
  notificationsSubscribeTool,
  notificationsGetSubscriptionTool,
  notificationsUnsubscribeTool,
} from "./notifications";
import type { SpApiClient } from "../../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

const GRANTLESS_SCOPE = "sellingpartnerapi::notifications";

describe("notificationsCreateDestinationTool", () => {
  it("creates SQS destination and returns payload", async () => {
    const client = mockClient({ payload: { name: "my-dest", destinationId: "D1", resource: {} } });
    const result = await notificationsCreateDestinationTool(client, {
      name: "my-dest",
      sqsArn: "arn:aws:sqs:us-east-1:123:MyQueue",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.payload.destinationId).toBe("D1");
    // Assert grantless is set on the underlying request
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toEqual({ scope: GRANTLESS_SCOPE });
    expect(opts.body.resourceSpecification.sqs.arn).toBe("arn:aws:sqs:us-east-1:123:MyQueue");
  });

  it("creates EventBridge destination", async () => {
    const client = mockClient({ payload: { name: "eb-dest", destinationId: "D2", resource: {} } });
    const result = await notificationsCreateDestinationTool(client, {
      name: "eb-dest",
      eventBridgeRegion: "us-east-1",
      eventBridgeAccountId: "123456789012",
    });
    expect(result.isError).toBeUndefined();
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.body.resourceSpecification.eventBridge).toEqual({
      region: "us-east-1",
      accountId: "123456789012",
    });
  });

  it("returns isError on failure", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("bad ARN")) } as unknown as SpApiClient;
    const result = await notificationsCreateDestinationTool(client, {
      name: "d",
      sqsArn: "invalid",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("bad ARN");
  });
});

describe("notificationsListDestinationsTool", () => {
  it("returns list of destinations", async () => {
    const client = mockClient({ payload: [{ name: "d1", destinationId: "D1", resource: {} }] });
    const result = await notificationsListDestinationsTool(client);
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.payload).toHaveLength(1);
    // grantless
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toEqual({ scope: GRANTLESS_SCOPE });
  });

  it("returns isError on failure", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("fail")) } as unknown as SpApiClient;
    const result = await notificationsListDestinationsTool(client);
    expect(result.isError).toBe(true);
  });
});

describe("notificationsDeleteDestinationTool", () => {
  it("deletes destination and returns confirmation", async () => {
    const client = mockClient({});
    const result = await notificationsDeleteDestinationTool(client, { destinationId: "D1" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.deleted).toBe(true);
    expect(parsed.destinationId).toBe("D1");
    // grantless
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toEqual({ scope: GRANTLESS_SCOPE });
  });

  it("returns isError on failure", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("not found")) } as unknown as SpApiClient;
    const result = await notificationsDeleteDestinationTool(client, { destinationId: "D1" });
    expect(result.isError).toBe(true);
  });
});

describe("notificationsSubscribeTool", () => {
  it("creates subscription and returns payload", async () => {
    const client = mockClient({ payload: { subscriptionId: "S1", payloadVersion: "1.0", destinationId: "D1" } });
    const result = await notificationsSubscribeTool(client, {
      notificationType: "ANY_OFFER_CHANGED",
      destinationId: "D1",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.payload.subscriptionId).toBe("S1");
    // Seller-authorized: no grantless
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toBeUndefined();
  });

  it("defaults payloadVersion to 1.0", async () => {
    const client = mockClient({ payload: { subscriptionId: "S1", payloadVersion: "1.0", destinationId: "D1" } });
    await notificationsSubscribeTool(client, {
      notificationType: "ANY_OFFER_CHANGED",
      destinationId: "D1",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.body.payloadVersion).toBe("1.0");
  });

  it("returns isError on failure", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("unauthorized")) } as unknown as SpApiClient;
    const result = await notificationsSubscribeTool(client, {
      notificationType: "ANY_OFFER_CHANGED",
      destinationId: "D1",
    });
    expect(result.isError).toBe(true);
  });
});

describe("notificationsGetSubscriptionTool", () => {
  it("returns subscription for notification type", async () => {
    const client = mockClient({ payload: { subscriptionId: "S1", payloadVersion: "1.0", destinationId: "D1" } });
    const result = await notificationsGetSubscriptionTool(client, { notificationType: "ANY_OFFER_CHANGED" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.payload.subscriptionId).toBe("S1");
    // Seller-authorized: no grantless
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toBeUndefined();
  });

  it("returns isError on failure", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("not found")) } as unknown as SpApiClient;
    const result = await notificationsGetSubscriptionTool(client, { notificationType: "X" });
    expect(result.isError).toBe(true);
  });
});

describe("notificationsUnsubscribeTool", () => {
  it("deletes subscription and returns confirmation", async () => {
    const client = mockClient({});
    const result = await notificationsUnsubscribeTool(client, {
      notificationType: "ANY_OFFER_CHANGED",
      subscriptionId: "S1",
    });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.unsubscribed).toBe(true);
    expect(parsed.subscriptionId).toBe("S1");
    // grantless
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toEqual({ scope: GRANTLESS_SCOPE });
  });

  it("returns isError on failure", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("gone")) } as unknown as SpApiClient;
    const result = await notificationsUnsubscribeTool(client, {
      notificationType: "X",
      subscriptionId: "S1",
    });
    expect(result.isError).toBe(true);
  });
});
