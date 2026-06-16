// src/operations/reports.test.ts
import { describe, it, expect, vi } from "vitest";
import { createReport, getReport, getReportDocument, reportTypes } from "./reports";
import type { SpApiClient } from "../client";

function mockClient(response: unknown): SpApiClient {
  return { request: vi.fn().mockResolvedValue(response) } as unknown as SpApiClient;
}

describe("createReport", () => {
  it("POSTs to /reports/2021-06-30/reports with correct body and returns reportId", async () => {
    const client = mockClient({ reportId: "RPT123" });
    const result = await createReport(client, {
      reportType: "GET_MERCHANT_LISTINGS_ALL_DATA",
      marketplaceIds: ["ATVPDKIKX0DER"],
      dataStartTime: "2024-01-01T00:00:00Z",
    });
    expect(result.reportId).toBe("RPT123");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("createReport");
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/reports/2021-06-30/reports");
    expect(opts.body).toMatchObject({
      reportType: "GET_MERCHANT_LISTINGS_ALL_DATA",
      marketplaceIds: ["ATVPDKIKX0DER"],
      dataStartTime: "2024-01-01T00:00:00Z",
    });
  });
});

describe("getReport", () => {
  it("GETs /reports/2021-06-30/reports/{reportId}", async () => {
    const client = mockClient({ reportId: "RPT123", processingStatus: "IN_QUEUE", reportType: "X", createdTime: "t" });
    const result = await getReport(client, "RPT123");
    expect(result.processingStatus).toBe("IN_QUEUE");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getReport");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/reports/2021-06-30/reports/RPT123");
  });
});

describe("getReportDocument", () => {
  it("GETs /reports/2021-06-30/documents/{reportDocumentId}", async () => {
    const client = mockClient({ reportDocumentId: "DOC1", url: "https://s3.example.com/doc", compressionAlgorithm: "GZIP" });
    const result = await getReportDocument(client, "DOC1");
    expect(result.url).toBe("https://s3.example.com/doc");
    expect(result.compressionAlgorithm).toBe("GZIP");
    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getReportDocument");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/reports/2021-06-30/documents/DOC1");
  });
});

describe("reportTypes", () => {
  it("exports an array of non-PII report type strings", () => {
    expect(Array.isArray(reportTypes)).toBe(true);
    expect(reportTypes.length).toBeGreaterThan(0);
    expect(reportTypes).toContain("GET_MERCHANT_LISTINGS_ALL_DATA");
  });
});
