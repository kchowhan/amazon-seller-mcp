// src/mcp/tools/reports.test.ts
import { describe, it, expect, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { reportRequestTool, reportGetDocumentTool, reportListTypesTool } from "./reports";
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

function mockClient(responses: unknown[]): SpApiClient {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  return { request: fn } as unknown as SpApiClient;
}

describe("reportRequestTool", () => {
  it("returns reportId on success", async () => {
    const client = mockClient([{ reportId: "RPT1" }]);
    const result = await reportRequestTool(client, config, {
      reportType: "GET_MERCHANT_LISTINGS_ALL_DATA",
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("RPT1");
  });

  it("uses config marketplaceIds when none provided", async () => {
    const client = mockClient([{ reportId: "RPT2" }]);
    await reportRequestTool(client, config, { reportType: "GET_MERCHANT_LISTINGS_ALL_DATA" });
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.body.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("returns isError when request rejects", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("network")) } as unknown as SpApiClient;
    const result = await reportRequestTool(client, config, { reportType: "X" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("network");
  });
});

describe("reportGetDocumentTool", () => {
  it("returns processingStatus when report is not DONE", async () => {
    const client = mockClient([{
      reportId: "RPT1",
      processingStatus: "IN_PROGRESS",
      reportType: "X",
      createdTime: "t",
    }]);
    const result = await reportGetDocumentTool(client, { reportId: "RPT1" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.processingStatus).toBe("IN_PROGRESS");
  });

  it("downloads and returns content when DONE", async () => {
    const content = "sku\tprice\nSKU1\t9.99";
    const client = mockClient([
      {
        reportId: "RPT1",
        processingStatus: "DONE",
        reportType: "X",
        createdTime: "t",
        reportDocumentId: "DOC1",
      },
      {
        reportDocumentId: "DOC1",
        url: "https://s3.example.com/report",
      },
    ]);
    const fetchFn = vi.fn().mockResolvedValue(new Response(content, { status: 200 }));
    const result = await reportGetDocumentTool(client, { reportId: "RPT1" }, fetchFn);
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.content).toBe(content);
    expect(parsed.truncated).toBe(false);
  });

  it("decompresses GZIP content when DONE", async () => {
    const original = "gzipped report content";
    const compressed = gzipSync(Buffer.from(original));
    const client = mockClient([
      {
        reportId: "RPT1",
        processingStatus: "DONE",
        reportType: "X",
        createdTime: "t",
        reportDocumentId: "DOC1",
      },
      {
        reportDocumentId: "DOC1",
        url: "https://s3.example.com/report.gz",
        compressionAlgorithm: "GZIP",
      },
    ]);
    const fetchFn = vi.fn().mockResolvedValue(new Response(compressed, { status: 200 }));
    const result = await reportGetDocumentTool(client, { reportId: "RPT1" }, fetchFn);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.content).toBe(original);
  });

  it("truncates content longer than 50k chars", async () => {
    const longContent = "x".repeat(60_000);
    const client = mockClient([
      {
        reportId: "RPT1",
        processingStatus: "DONE",
        reportType: "X",
        createdTime: "t",
        reportDocumentId: "DOC1",
      },
      { reportDocumentId: "DOC1", url: "https://s3.example.com/big" },
    ]);
    const fetchFn = vi.fn().mockResolvedValue(new Response(longContent, { status: 200 }));
    const result = await reportGetDocumentTool(client, { reportId: "RPT1" }, fetchFn);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.truncated).toBe(true);
    expect(parsed.content).toContain("[truncated]");
  });

  it("returns isError when getReport rejects", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("fail")) } as unknown as SpApiClient;
    const result = await reportGetDocumentTool(client, { reportId: "RPT1" });
    expect(result.isError).toBe(true);
  });
});

describe("reportListTypesTool", () => {
  it("returns an array of report type strings", () => {
    const result = reportListTypesTool();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toContain("GET_MERCHANT_LISTINGS_ALL_DATA");
  });
});
