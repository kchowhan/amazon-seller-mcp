// src/operations/finances.test.ts
import { describe, it, expect, vi } from "vitest";
import { listFinancialEvents } from "./finances";
import type { SpApiClient } from "../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

describe("listFinancialEvents", () => {
  it("GETs /finances/v0/financialEvents with no params", async () => {
    const client = mockClient({ payload: { FinancialEvents: {} } });
    const result = await listFinancialEvents(client);
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("listFinancialEvents");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/finances/v0/financialEvents");
    expect(result.payload?.FinancialEvents).toBeDefined();
  });

  it("passes MaxResultsPerPage, PostedAfter, PostedBefore, NextToken in query (exact casing)", async () => {
    const client = mockClient({ payload: {} });
    await listFinancialEvents(client, {
      MaxResultsPerPage: 50,
      PostedAfter: "2024-01-01T00:00:00Z",
      PostedBefore: "2024-12-31T23:59:59Z",
      NextToken: "tok123",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.MaxResultsPerPage).toBe(50);
    expect(opts.query.PostedAfter).toBe("2024-01-01T00:00:00Z");
    expect(opts.query.PostedBefore).toBe("2024-12-31T23:59:59Z");
    expect(opts.query.NextToken).toBe("tok123");
  });

  it("does not set grantless (seller-authorized operation)", async () => {
    const client = mockClient({ payload: {} });
    await listFinancialEvents(client);
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.grantless).toBeUndefined();
  });
});
