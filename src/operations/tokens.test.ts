// src/operations/tokens.test.ts
import { describe, it, expect, vi } from "vitest";
import { createRestrictedDataToken } from "./tokens";
import type { SpApiClient } from "../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

describe("createRestrictedDataToken", () => {
  it("POSTs to /tokens/2021-03-01/restrictedDataToken with restrictedResources in the body", async () => {
    const client = mockClient({
      restrictedDataToken: "Atz.sprdt|TESTTOKEN",
      expiresIn: 3600,
    });

    const resources = [
      { method: "GET", path: "/orders/v0/orders", dataElements: ["buyerInfo"] },
    ];
    const result = await createRestrictedDataToken(client, resources);

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("createRestrictedDataToken");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/tokens/2021-03-01/restrictedDataToken");
    expect(opts.body).toEqual({ restrictedResources: resources });
    expect(result.restrictedDataToken).toBe("Atz.sprdt|TESTTOKEN");
    expect(result.expiresIn).toBe(3600);
  });

  it("forwards multiple restricted resources", async () => {
    const client = mockClient({ restrictedDataToken: "RDT_MULTI", expiresIn: 3600 });

    const resources = [
      { method: "GET", path: "/orders/v0/orders/111-000-111", dataElements: ["buyerInfo", "shippingAddress"] },
      { method: "GET", path: "/orders/v0/orders/111-000-111/orderItems", dataElements: ["buyerInfo"] },
    ];
    await createRestrictedDataToken(client, resources);

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.body).toEqual({ restrictedResources: resources });
  });

  it("does not set grantless or restrictedResources on the inner request (uses normal token)", async () => {
    const client = mockClient({ restrictedDataToken: "RDT3", expiresIn: 3600 });
    await createRestrictedDataToken(client, [{ method: "GET", path: "/orders/v0/orders" }]);
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toBeUndefined();
    expect(opts.restrictedResources).toBeUndefined();
  });
});
