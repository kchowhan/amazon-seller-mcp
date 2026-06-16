// src/operations/notifications.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  getDestinations,
  createDestination,
  deleteDestination,
  createSubscription,
  getSubscription,
  deleteSubscriptionById,
} from "./notifications";
import type { SpApiClient } from "../client";

const GRANTLESS_SCOPE = "sellingpartnerapi::notifications";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

// ---- Grantless destination operations ----

describe("getDestinations", () => {
  it("GETs /notifications/v1/destinations", async () => {
    const client = mockClient({ payload: [] });
    await getDestinations(client);
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getDestinations");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/notifications/v1/destinations");
  });

  it("sets grantless scope", async () => {
    const client = mockClient({ payload: [] });
    await getDestinations(client);
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toEqual({ scope: GRANTLESS_SCOPE });
  });
});

describe("createDestination", () => {
  it("POSTs to /notifications/v1/destinations with SQS body", async () => {
    const client = mockClient({ payload: { name: "my-dest", destinationId: "D1", resource: {} } });
    await createDestination(client, {
      name: "my-dest",
      resourceSpecification: { sqs: { arn: "arn:aws:sqs:us-east-1:123:MyQueue" } },
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("createDestination");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/notifications/v1/destinations");
    expect(opts.body.name).toBe("my-dest");
    expect(opts.body.resourceSpecification.sqs.arn).toBe("arn:aws:sqs:us-east-1:123:MyQueue");
  });

  it("sets grantless scope", async () => {
    const client = mockClient({ payload: {} });
    await createDestination(client, {
      name: "d",
      resourceSpecification: { eventBridge: { region: "us-east-1", accountId: "123456789012" } },
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toEqual({ scope: GRANTLESS_SCOPE });
  });
});

describe("deleteDestination", () => {
  it("DELETEs /notifications/v1/destinations/{destinationId}", async () => {
    const client = mockClient({});
    await deleteDestination(client, "D1");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("deleteDestination");
    expect(opts.method).toBe("DELETE");
    expect(opts.path).toBe("/notifications/v1/destinations/D1");
  });

  it("sets grantless scope", async () => {
    const client = mockClient({});
    await deleteDestination(client, "D1");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toEqual({ scope: GRANTLESS_SCOPE });
  });
});

// ---- Seller-authorized subscription operations ----

describe("createSubscription", () => {
  it("POSTs to /notifications/v1/subscriptions/{notificationType}", async () => {
    const client = mockClient({ payload: { subscriptionId: "S1", payloadVersion: "1.0", destinationId: "D1" } });
    await createSubscription(client, "ANY_OFFER_CHANGED", {
      payloadVersion: "1.0",
      destinationId: "D1",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("createSubscription");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/notifications/v1/subscriptions/ANY_OFFER_CHANGED");
    expect(opts.body.payloadVersion).toBe("1.0");
    expect(opts.body.destinationId).toBe("D1");
  });

  it("does NOT set grantless (seller-authorized)", async () => {
    const client = mockClient({ payload: {} });
    await createSubscription(client, "ANY_OFFER_CHANGED", {
      payloadVersion: "1.0",
      destinationId: "D1",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toBeUndefined();
  });
});

describe("getSubscription", () => {
  it("GETs /notifications/v1/subscriptions/{notificationType}", async () => {
    const client = mockClient({ payload: { subscriptionId: "S1", payloadVersion: "1.0", destinationId: "D1" } });
    await getSubscription(client, "ANY_OFFER_CHANGED");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getSubscription");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/notifications/v1/subscriptions/ANY_OFFER_CHANGED");
  });

  it("does NOT set grantless (seller-authorized)", async () => {
    const client = mockClient({ payload: {} });
    await getSubscription(client, "ANY_OFFER_CHANGED");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toBeUndefined();
  });
});

describe("deleteSubscriptionById", () => {
  it("DELETEs /notifications/v1/subscriptions/{notificationType}/{subscriptionId}", async () => {
    const client = mockClient({});
    await deleteSubscriptionById(client, "ANY_OFFER_CHANGED", "S1");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("deleteSubscriptionById");
    expect(opts.method).toBe("DELETE");
    expect(opts.path).toBe("/notifications/v1/subscriptions/ANY_OFFER_CHANGED/S1");
  });

  it("sets grantless scope", async () => {
    const client = mockClient({});
    await deleteSubscriptionById(client, "ANY_OFFER_CHANGED", "S1");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toEqual({ scope: GRANTLESS_SCOPE });
  });
});
