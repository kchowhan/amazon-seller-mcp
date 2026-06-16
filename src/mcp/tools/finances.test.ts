// src/mcp/tools/finances.test.ts
import { describe, it, expect, vi } from "vitest";
import { financeListEventsTool } from "./finances";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";

const config: SpApiConfig = {
  lwaClientId: "id",
  lwaClientSecret: "sec",
  refreshToken: "rt",
  marketplaceIds: ["ATVPDKIKX0DER"],
  region: "na",
  sandbox: false,
};

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

describe("financeListEventsTool", () => {
  it("returns financial events on success", async () => {
    const client = mockClient({
      payload: { FinancialEvents: { ShipmentEventList: [] }, NextToken: "next1" },
    });
    const result = await financeListEventsTool(client, config, {});
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.payload.NextToken).toBe("next1");
  });

  it("passes postedAfter, postedBefore, nextToken to the operation", async () => {
    const client = mockClient({ payload: {} });
    await financeListEventsTool(client, config, {
      postedAfter: "2024-01-01T00:00:00Z",
      postedBefore: "2024-06-01T00:00:00Z",
      nextToken: "tok",
    });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.PostedAfter).toBe("2024-01-01T00:00:00Z");
    expect(opts.query.PostedBefore).toBe("2024-06-01T00:00:00Z");
    expect(opts.query.NextToken).toBe("tok");
  });

  it("defaults maxResultsPerPage to 100 when not provided", async () => {
    const client = mockClient({ payload: {} });
    await financeListEventsTool(client, config, {});
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.MaxResultsPerPage).toBe(100);
  });

  it("returns isError when operation rejects", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("forbidden")) } as unknown as SpApiClient;
    const result = await financeListEventsTool(client, config, {});
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("forbidden");
  });
});
