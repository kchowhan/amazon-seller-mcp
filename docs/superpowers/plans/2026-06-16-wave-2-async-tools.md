# Wave 2: Async + Remaining Cheap-Lane Tools

> Ground every endpoint in Amazon's official OpenAPI model. Follow the established patterns: `src/operations/*.ts`, the per-group MCP modules under `src/mcp/tools/<group>.ts` (handlers + `register<Group>Tools`), and `src/mcp/server.ts` (call the new register functions). TDD throughout.

**Goal:** Reports (async create/poll/download with gzip), Feeds (document upload/submit/poll/result), Finances, Sales, and Notifications (destination + subscription management, incl. grantless tokens).

**Model dirs (amzn/selling-partner-api-models, fetch raw JSON, confirm filenames):** `reports-api-model` (reports 2021-06-30), `feeds-api-model` (feeds 2021-06-30), `finances-api-model` (finances v0), `sales-api-model` (sales v1), `notifications-api-model` (notifications v1).

---

## Task 1: Document transfer helper (presigned URL upload/download + gunzip)

Reports and Feeds exchange large payloads via Amazon-provided presigned URLs (S3), NOT via the SP-API base host. Create `src/operations/documents.ts`:

```ts
// src/operations/documents.ts
import { gunzipSync } from "node:zlib";
import type { FetchLike } from "../auth/lwaTokenClient";

// Download a report/feed-result document from its presigned URL and decompress if needed.
export async function downloadDocument(
  url: string,
  compressionAlgorithm: "GZIP" | undefined,
  fetchFn: FetchLike = fetch,
): Promise<string> {
  const res = await fetchFn(url, { method: "GET" });
  if (!res.ok) throw new Error(`Document download failed with status ${res.status}`);
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
```

- [ ] TDD: mock `fetchFn`; assert GZIP path gunzips (use `zlib.gzipSync` of a known string in the mock Response body), non-GZIP returns text, upload sends PUT + content-type, non-ok throws. Commit.

## Task 2: Grantless token support in the client

Notification destination-management operations are grantless (LWA `client_credentials`, scope `sellingpartnerapi::notifications`). Extend the transport:
- In `src/client.ts` `RequestOptions`, add `grantless?: { scope: string }`.
- In `request`, when `options.grantless` is set, obtain the token via `this.tokenClient.getGrantlessToken(options.grantless.scope)` instead of `getAccessToken()`. (The `LwaTokenClient.getGrantlessToken(scope)` method already exists.)

- [ ] TDD in `src/client.test.ts`: a request with `grantless: { scope: "sellingpartnerapi::notifications" }` calls a `getGrantlessToken` spy (add it to the fake token client) and not `getAccessToken`; the returned token is sent in `x-amz-access-token`. Commit.

## Task 3: Reports (reports/2021-06-30)

`src/operations/reports.ts`:
- `createReport`: POST `/reports/2021-06-30/reports`, body `{ reportType, marketplaceIds, dataStartTime?, dataEndTime?, reportOptions? }` -> `{ reportId }`.
- `getReport`: GET `/reports/2021-06-30/reports/{reportId}` -> `{ processingStatus, reportDocumentId?, ... }`.
- `getReportDocument`: GET `/reports/2021-06-30/documents/{reportDocumentId}` -> `{ url, compressionAlgorithm? }`.
- `reportTypes`: a small exported const array of common NON-PII report types (e.g. `GET_MERCHANT_LISTINGS_ALL_DATA`, `GET_FLAT_FILE_OPEN_LISTINGS_DATA`, `GET_SALES_AND_TRAFFIC_REPORT`, `GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT`, `GET_FBA_INVENTORY_PLANNING_DATA`). Used by `report_list_types`.

Tools (`src/mcp/tools/reports.ts`):
- `report_request` (inputs: reportType, marketplaceIds optional default config, dataStartTime?, dataEndTime?) -> returns reportId.
- `report_get_document` (input: reportId): call `getReport`; if `processingStatus !== "DONE"`, return a text result with the status; if DONE, `getReportDocument` then `downloadDocument(url, compressionAlgorithm)` and return the content (truncate to a sane length, e.g. first 50k chars, noting truncation).
- `report_list_types` (no input): return the `reportTypes` array.

Inject the document fetch: `report_get_document` should accept an optional `fetchFn` parameter (default `fetch`) threaded into `downloadDocument`, so tests can mock the presigned download.

- [ ] TDD operations (mock client.request) and tools (mock client + a fake document fetch). Cover: not-DONE returns status; DONE downloads + returns content. Commit.

## Task 4: Feeds (feeds/2021-06-30)

`src/operations/feeds.ts`:
- `createFeedDocument`: POST `/feeds/2021-06-30/documents`, body `{ contentType }` -> `{ feedDocumentId, url }`.
- `createFeed`: POST `/feeds/2021-06-30/feeds`, body `{ feedType, marketplaceIds, inputFeedDocumentId, feedOptions? }` -> `{ feedId }`.
- `getFeed`: GET `/feeds/2021-06-30/feeds/{feedId}` -> `{ processingStatus, resultFeedDocumentId?, ... }`.
- `getFeedDocument`: GET `/feeds/2021-06-30/documents/{feedDocumentId}` -> `{ url, compressionAlgorithm? }`.

Tools (`src/mcp/tools/feeds.ts`):
- `feed_submit` (inputs: feedType, content (string), contentType default `text/tab-separated-values; charset=UTF-8`, marketplaceIds optional default config): `createFeedDocument({contentType})` -> `uploadDocument(url, content, contentType)` -> `createFeed({feedType, marketplaceIds, inputFeedDocumentId: feedDocumentId})` -> return feedId.
- `feed_get_result` (input: feedId): `getFeed`; if not DONE return status; if DONE and `resultFeedDocumentId` present, `getFeedDocument` + `downloadDocument` and return the processing report (truncate as above).
Thread an optional `fetchFn` for the upload/download so tests can mock them.

- [ ] TDD operations + tools (mock client + fake document fetch). Commit.

## Task 5: Finances (finances/v0)

`src/operations/finances.ts`:
- `listFinancialEvents`: GET `/finances/v0/financialEvents`, query `MaxResultsPerPage?`, `PostedAfter?`, `PostedBefore?`, `NextToken?` (confirm casing against model). 

Tool (`src/mcp/tools/finances.ts`):
- `finance_list_events` (inputs: postedAfter?, postedBefore?, maxResultsPerPage default 100, nextToken?).

- [ ] TDD operation + tool. Commit.

## Task 6: Sales (sales/v1)

`src/operations/sales.ts`:
- `getOrderMetrics`: GET `/sales/v1/orderMetrics`, query `marketplaceIds` (required), `interval` (required, an ISO8601 interval), `granularity` (e.g. `Day`), `granularityTimeZone?`, plus optional filters (confirm against model).

Tool (`src/mcp/tools/sales.ts`):
- `sales_get_metrics` (inputs: interval (required), granularity default `Day`, marketplaceIds optional default config, granularityTimeZone?).

- [ ] TDD operation + tool. Commit.

## Task 7: Notifications (notifications/v1)

`src/operations/notifications.ts` (destination ops are GRANTLESS: pass `grantless: { scope: "sellingpartnerapi::notifications" }`):
- `getDestinations` (GET `/notifications/v1/destinations`, grantless)
- `createDestination` (POST `/notifications/v1/destinations`, grantless; body `{ name, resourceSpecification: { sqs?: { arn }, eventBridge?: { region, accountId } } }`)
- `deleteDestination` (DELETE `/notifications/v1/destinations/{destinationId}`, grantless)
- `createSubscription` (POST `/notifications/v1/subscriptions/{notificationType}`; body `{ payloadVersion, destinationId }`) -- NOT grantless (seller-authorized)
- `getSubscription` (GET `/notifications/v1/subscriptions/{notificationType}`) -- seller-authorized
- `deleteSubscriptionById` (DELETE `/notifications/v1/subscriptions/{notificationType}/{subscriptionId}`, grantless)

Tools (`src/mcp/tools/notifications.ts`):
- `notifications_create_destination` (inputs: name, sqsArn? OR eventBridge {region, accountId})
- `notifications_list_destinations` (no input)
- `notifications_delete_destination` (input: destinationId)
- `notifications_subscribe` (inputs: notificationType, destinationId, payloadVersion default `1.0`)
- `notifications_get_subscription` (input: notificationType)
- `notifications_unsubscribe` (inputs: notificationType, subscriptionId)

- [ ] TDD operations (assert grantless flag on destination ops) + tools. Commit.

## Task 8: Wire-up + verification

- [ ] Register all new groups in `src/mcp/server.ts`. Run `npm test`, `npm run typecheck`, `npm run build`, and the stdio smoke test; confirm the new tool names appear. Commit any final wiring.

## Acceptance criteria
- Paths/params/casing confirmed against official models.
- Async tools (`report_get_document`, `feed_get_result`) return status when not DONE and content (decompressed, truncated) when DONE; document transfer uses injectable fetch and is tested.
- Grantless flag used for notification destination ops and verified by test.
- Every tool returns `errorResult` on failure. `npm test`/`typecheck`/`build`/smoke all green.
