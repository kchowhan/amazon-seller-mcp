// src/mcp/tools/feeds.test.ts
import { describe, it, expect, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { feedSubmitTool, feedGetResultTool } from "./feeds";
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

describe("feedSubmitTool", () => {
  it("creates doc, uploads, creates feed, and returns feedId + feedDocumentId", async () => {
    const client = mockClient([
      { feedDocumentId: "FD1", url: "https://s3.example.com/upload" }, // createFeedDocument
      { feedId: "FEED1" }, // createFeed
    ]);
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const result = await feedSubmitTool(
      client,
      config,
      { feedType: "POST_PRODUCT_DATA", content: "sku\tprice\nSKU1\t9.99" },
      fetchFn,
    );

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.feedId).toBe("FEED1");
    expect(parsed.feedDocumentId).toBe("FD1");

    // Assert upload PUT was called with correct URL
    const [uploadUrl, uploadInit] = fetchFn.mock.calls[0]!;
    expect(uploadUrl).toBe("https://s3.example.com/upload");
    expect(uploadInit.method).toBe("PUT");

    // Assert createFeed body has correct inputFeedDocumentId
    const createFeedOpts = (client.request as ReturnType<typeof vi.fn>).mock.calls[1]![0];
    expect(createFeedOpts.body.inputFeedDocumentId).toBe("FD1");
    expect(createFeedOpts.body.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("uses default content-type when not provided", async () => {
    const client = mockClient([
      { feedDocumentId: "FD1", url: "https://s3.example.com/upload" },
      { feedId: "FEED1" },
    ]);
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await feedSubmitTool(client, config, { feedType: "POST_PRODUCT_DATA", content: "data" }, fetchFn);
    const [, uploadInit] = fetchFn.mock.calls[0]!;
    expect((uploadInit.headers as Record<string, string>)["content-type"]).toBe(
      "text/tab-separated-values; charset=UTF-8",
    );
  });

  it("returns isError when createFeedDocument rejects", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("API error")) } as unknown as SpApiClient;
    const result = await feedSubmitTool(client, config, { feedType: "X", content: "data" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("API error");
  });
});

describe("feedGetResultTool", () => {
  it("returns processingStatus when feed is not DONE", async () => {
    const client = mockClient([{
      feedId: "FEED1",
      feedType: "X",
      processingStatus: "IN_QUEUE",
      createdTime: "t",
    }]);
    const result = await feedGetResultTool(client, { feedId: "FEED1" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.processingStatus).toBe("IN_QUEUE");
  });

  it("downloads processing report when DONE", async () => {
    const reportContent = "processingReport\tstatus\nSKU1\tSuccess";
    const client = mockClient([
      {
        feedId: "FEED1",
        feedType: "X",
        processingStatus: "DONE",
        createdTime: "t",
        resultFeedDocumentId: "RFD1",
      },
      { feedDocumentId: "RFD1", url: "https://s3.example.com/result" },
    ]);
    const fetchFn = vi.fn().mockResolvedValue(new Response(reportContent, { status: 200 }));

    const result = await feedGetResultTool(client, { feedId: "FEED1" }, fetchFn);
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.content).toBe(reportContent);
    expect(parsed.truncated).toBe(false);
  });

  it("decompresses GZIP processing report when DONE", async () => {
    const original = "processing report content";
    const compressed = gzipSync(Buffer.from(original));
    const client = mockClient([
      {
        feedId: "FEED1",
        feedType: "X",
        processingStatus: "DONE",
        createdTime: "t",
        resultFeedDocumentId: "RFD1",
      },
      { feedDocumentId: "RFD1", url: "https://s3.example.com/result.gz", compressionAlgorithm: "GZIP" },
    ]);
    const fetchFn = vi.fn().mockResolvedValue(new Response(compressed, { status: 200 }));

    const result = await feedGetResultTool(client, { feedId: "FEED1" }, fetchFn);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.content).toBe(original);
  });

  it("truncates long processing reports", async () => {
    const longContent = "x".repeat(60_000);
    const client = mockClient([
      {
        feedId: "FEED1",
        feedType: "X",
        processingStatus: "DONE",
        createdTime: "t",
        resultFeedDocumentId: "RFD1",
      },
      { feedDocumentId: "RFD1", url: "https://s3.example.com/big" },
    ]);
    const fetchFn = vi.fn().mockResolvedValue(new Response(longContent, { status: 200 }));

    const result = await feedGetResultTool(client, { feedId: "FEED1" }, fetchFn);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.truncated).toBe(true);
    expect(parsed.content).toContain("[truncated]");
  });

  it("returns isError when getFeed rejects", async () => {
    const client = { request: vi.fn().mockRejectedValue(new Error("fail")) } as unknown as SpApiClient;
    const result = await feedGetResultTool(client, { feedId: "FEED1" });
    expect(result.isError).toBe(true);
  });
});
