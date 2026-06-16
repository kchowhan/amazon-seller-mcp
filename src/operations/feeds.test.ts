// src/operations/feeds.test.ts
import { describe, it, expect, vi } from "vitest";
import { createFeedDocument, createFeed, getFeed, getFeedDocument } from "./feeds";
import type { SpApiClient } from "../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

describe("createFeedDocument", () => {
  it("POSTs to /feeds/2021-06-30/documents with contentType body", async () => {
    const client = mockClient({ feedDocumentId: "FD1", url: "https://s3.example.com/upload" });
    const result = await createFeedDocument(client, "text/tab-separated-values; charset=UTF-8");
    expect(result.feedDocumentId).toBe("FD1");
    expect(result.url).toBe("https://s3.example.com/upload");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("createFeedDocument");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/feeds/2021-06-30/documents");
    expect(opts.body).toEqual({ contentType: "text/tab-separated-values; charset=UTF-8" });
  });
});

describe("createFeed", () => {
  it("POSTs to /feeds/2021-06-30/feeds with correct body", async () => {
    const client = mockClient({ feedId: "FEED1" });
    const result = await createFeed(client, {
      feedType: "POST_PRODUCT_DATA",
      marketplaceIds: ["ATVPDKIKX0DER"],
      inputFeedDocumentId: "FD1",
    });
    expect(result.feedId).toBe("FEED1");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("createFeed");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/feeds/2021-06-30/feeds");
    expect(opts.body).toMatchObject({
      feedType: "POST_PRODUCT_DATA",
      marketplaceIds: ["ATVPDKIKX0DER"],
      inputFeedDocumentId: "FD1",
    });
  });
});

describe("getFeed", () => {
  it("GETs /feeds/2021-06-30/feeds/{feedId}", async () => {
    const client = mockClient({ feedId: "FEED1", feedType: "X", processingStatus: "IN_QUEUE", createdTime: "t" });
    const result = await getFeed(client, "FEED1");
    expect(result.processingStatus).toBe("IN_QUEUE");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getFeed");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/feeds/2021-06-30/feeds/FEED1");
  });
});

describe("getFeedDocument", () => {
  it("GETs /feeds/2021-06-30/documents/{feedDocumentId}", async () => {
    const client = mockClient({ feedDocumentId: "FD1", url: "https://s3.example.com/result", compressionAlgorithm: "GZIP" });
    const result = await getFeedDocument(client, "FD1");
    expect(result.url).toBe("https://s3.example.com/result");
    expect(result.compressionAlgorithm).toBe("GZIP");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getFeedDocument");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/feeds/2021-06-30/documents/FD1");
  });
});
