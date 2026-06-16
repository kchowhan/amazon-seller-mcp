// src/operations/documents.test.ts
import { describe, it, expect, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { downloadDocument, uploadDocument } from "./documents";

function okResponse(body: Buffer | string, status = 200): Response {
  const buf = typeof body === "string" ? Buffer.from(body) : body;
  return new Response(buf, { status });
}

describe("downloadDocument", () => {
  it("returns plain text when compressionAlgorithm is undefined", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse("hello world"));
    const result = await downloadDocument("https://s3.example.com/doc", undefined, fetchFn);
    expect(result).toBe("hello world");
    expect(fetchFn).toHaveBeenCalledWith("https://s3.example.com/doc", { method: "GET" });
  });

  it("gunzips the response body when compressionAlgorithm is GZIP", async () => {
    const original = "gzipped content here";
    const compressed = gzipSync(Buffer.from(original));
    const fetchFn = vi.fn().mockResolvedValue(okResponse(compressed));
    const result = await downloadDocument("https://s3.example.com/doc.gz", "GZIP", fetchFn);
    expect(result).toBe(original);
  });

  it("throws when the response is not ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 }));
    await expect(
      downloadDocument("https://s3.example.com/doc", undefined, fetchFn),
    ).rejects.toThrow("Document download failed with status 403");
  });

  it("throws when content-length exceeds 100MB without reading the body", async () => {
    const oversizeBytes = 100 * 1024 * 1024 + 1;
    const arrayBufferFn = vi.fn();
    const mockRes = {
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === "content-length" ? String(oversizeBytes) : null) },
      arrayBuffer: arrayBufferFn,
    } as unknown as Response;
    const fetchFn = vi.fn().mockResolvedValue(mockRes);
    await expect(
      downloadDocument("https://s3.example.com/huge", undefined, fetchFn),
    ).rejects.toThrow(`Document too large: ${oversizeBytes} bytes exceeds 100MB limit`);
    expect(arrayBufferFn).not.toHaveBeenCalled();
  });
});

describe("uploadDocument", () => {
  it("sends a PUT with the correct content-type and body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await uploadDocument("https://s3.example.com/upload", "feed data", "text/plain", fetchFn);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://s3.example.com/upload");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("text/plain");
    expect(init.body).toBe("feed data");
  });

  it("throws when the upload response is not ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));
    await expect(
      uploadDocument("https://s3.example.com/upload", "data", "text/plain", fetchFn),
    ).rejects.toThrow("Document upload failed with status 500");
  });
});
