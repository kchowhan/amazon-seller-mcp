// src/operations/documents.ts
// Presigned URL document transfer helpers used by Reports and Feeds.
import { gunzipSync } from "node:zlib";
import type { FetchLike } from "../auth/lwaTokenClient";

const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024; // 100 MB

// Download a report/feed-result document from its presigned URL and decompress if needed.
export async function downloadDocument(
  url: string,
  compressionAlgorithm: "GZIP" | undefined,
  fetchFn: FetchLike = fetch,
): Promise<string> {
  const res = await fetchFn(url, { method: "GET" });
  if (!res.ok) throw new Error(`Document download failed with status ${res.status}`);
  const contentLength = res.headers.get("content-length");
  if (contentLength !== null) {
    const bytes = parseInt(contentLength, 10);
    if (bytes > MAX_DOCUMENT_BYTES) {
      throw new Error(`Document too large: ${bytes} bytes exceeds 100MB limit`);
    }
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const bytes = compressionAlgorithm === "GZIP" ? gunzipSync(buf) : buf;
  return bytes.toString("utf-8");
}

// Upload feed content to its presigned URL (PUT). contentType must match what createFeedDocument was told.
export async function uploadDocument(
  url: string,
  content: string,
  contentType: string,
  fetchFn: FetchLike = fetch,
): Promise<void> {
  const res = await fetchFn(url, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: content,
  });
  if (!res.ok) throw new Error(`Document upload failed with status ${res.status}`);
}
