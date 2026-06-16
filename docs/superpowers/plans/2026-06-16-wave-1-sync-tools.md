# Wave 1: Synchronous Read/Write Tools

> **For agentic workers:** implement task-by-task with TDD. Ground every endpoint (path, method, query/casing, request/response shape) in Amazon's official OpenAPI model for that API; do not invent paths from memory.

**Goal:** Add the synchronous cheap-lane tools (Catalog, Listings, Product Type Definitions, FBA Inventory, Pricing, Fees) on top of the existing transport core.

**Pattern (already in the repo, follow it exactly):**
- `src/operations/<group>.ts` exports typed async functions taking `(client: SpApiClient, ...args)` and calling `client.request<T>({ operation, method, path, query?, body?, rateLimit? })`. See `src/operations/sellers.ts`.
- `src/mcp/tools.ts` exports pure handler functions returning `ToolResult` (use the existing `textResult` and `errorResult` helpers; wrap calls in try/catch via `errorResult`).
- `src/mcp/server.ts` registers each tool with `server.registerTool(name, { description, inputSchema }, handler)` using zod shapes for inputs.
- Tests: `src/operations/<group>.test.ts` (mock `SpApiClient.request`) and add cases to `src/mcp/tools.test.ts`. TDD: failing test, confirm fail, implement, confirm pass.

**Model source:** `https://github.com/amzn/selling-partner-api-models`, directory `models/`. Fetch the raw JSON for each API (browse the repo to find exact filenames) and read the path + parameters + schema. Raw URL form: `https://raw.githubusercontent.com/amzn/selling-partner-api-models/main/models/<dir>/<file>.json`.

**Important casing note:** query-param casing differs by API. Catalog 2022-04-01, Listings 2021-08-01, Product Type Definitions 2020-09-01, and FBA Inventory use camelCase (`marketplaceIds`). Product Pricing v0 and Product Fees v0 use PascalCase (`MarketplaceId`, `Asins`, `ItemCondition`). Confirm each against the model.

---

## Task 1: Config: optional seller id

**Files:** modify `src/config.ts`, `src/config.test.ts`

- [ ] Add an optional `sellerId?: string` to `SpApiConfig`, read from `SPAPI_SELLER_ID` (no error if absent). Add `SPAPI_SELLER_ID=` to `.env.example` with a comment that it's the seller/merchant token, required only for Listings Items operations. Add a test that it is parsed when present and `undefined` when absent. Keep all existing tests passing. Commit.

## Task 2: Catalog Items (catalog/2022-04-01)

**Files:** `src/operations/catalog.ts` (+ test); register tools in `tools.ts`/`server.ts` (+ tool tests)

Model: `catalog-items-api-model` (catalogItems_2022-04-01).
- `searchCatalogItems`: GET `/catalog/2022-04-01/items`, query `marketplaceIds` (required, array), plus optional `keywords`, `identifiers`, `identifiersType`, `includedData`, `pageSize`, `pageToken`, `brandNames`, `classificationIds`. Tool `catalog_search` (inputs: keywords or identifiers, marketplaceIds optional -> default from config).
- `getCatalogItem`: GET `/catalog/2022-04-01/items/{asin}`, query `marketplaceIds` (required), optional `includedData`. Tool `catalog_get_item` (inputs: asin, marketplaceIds optional).

- [ ] TDD operation functions (mock client, assert operation/method/path/query). TDD tool handlers. Default `marketplaceIds` to `config.marketplaceIds` when the caller omits it. Commit.

## Task 3: Listings Items (listings/2021-08-01)

**Files:** `src/operations/listings.ts` (+ test); tools

Model: `listings-items-api-model` (listingsItems_2021-08-01). Path base: `/listings/2021-08-01/items/{sellerId}/{sku}`, query `marketplaceIds` (required); `includedData` on GET; body `{ productType, requirements?, attributes }` on PUT; body `{ productType, patches: [{op, path, value}] }` on PATCH.
- `getListingsItem` (GET) -> tool `listing_get`
- `putListingsItem` (PUT) -> tool `listing_put`
- `patchListingsItem` (PATCH) -> tool `listing_patch`
- `deleteListingsItem` (DELETE) -> tool `listing_delete`

`sellerId` resolution: each operation takes a `sellerId` argument; the tool handlers default it to `config.sellerId` and return an `errorResult` with a clear message ("set SPAPI_SELLER_ID or pass sellerId") if neither is present.

- [ ] TDD operations + tools. Commit.

## Task 4: Product Type Definitions (definitions/2020-09-01)

**Files:** `src/operations/productTypes.ts` (+ test); tool

Model: `product-type-definitions-api-model`.
- `getDefinitionsProductType`: GET `/definitions/2020-09-01/productTypes/{productType}`, query `marketplaceIds` (required), optional `requirements`, `locale`. Tool `product_type_get_schema` (inputs: productType, marketplaceIds optional).

- [ ] TDD operation + tool. Commit.

## Task 5: FBA Inventory (fba/inventory/v1)

**Files:** `src/operations/fbaInventory.ts` (+ test); tool

Model: `fba-inventory-api-model`.
- `getInventorySummaries`: GET `/fba/inventory/v1/summaries`, query `granularityType` (e.g. `Marketplace`), `granularityId` (a marketplace id), `marketplaceIds` (required), optional `details`, `startDateTime`, `sellerSkus`, `nextToken`. Tool `inventory_get_fba` (inputs: marketplaceId optional default first config marketplace, details default true).

- [ ] TDD operation + tool. Commit.

## Task 6: Product Pricing v0 (products/pricing/v0)

**Files:** `src/operations/pricing.ts` (+ test); tools

Model: `product-pricing-api-model` (v0). PascalCase params.
- `getCompetitivePricing`: GET `/products/pricing/v0/competitivePrice`, query `MarketplaceId` (required), `Asins` or `Skus` (array), `ItemType` (`Asin`|`Sku`). Tool `pricing_get_competitive` (inputs: asins[] or skus[], marketplaceId optional).
- `getItemOffers`: GET `/products/pricing/v0/items/{Asin}/offers`, query `MarketplaceId` (required), `ItemCondition` (e.g. `New`), optional `CustomerType`. Tool `pricing_get_item_offers` (inputs: asin, itemCondition default New, marketplaceId optional).

- [ ] TDD operations + tools. Commit.

## Task 7: Product Fees v0 (products/fees/v0)

**Files:** `src/operations/fees.ts` (+ test); tool

Model: `product-fees-api-model` (v0).
- `getMyFeesEstimateForASIN`: POST `/products/fees/v0/items/{Asin}/feesEstimate`, body `{ FeesEstimateRequest: { MarketplaceId, IsAmazonFulfilled, Identifier, PriceToEstimateFees: { ListingPrice: { CurrencyCode, Amount } } } }`. Tool `fees_estimate` (inputs: asin, price (number), currencyCode default USD, isAmazonFulfilled default true, marketplaceId optional).

- [ ] TDD operation + tool. Commit.

## Task 8: Wire-up verification

- [ ] Run `npm test` (all green), `npm run typecheck` (clean), `npm run build`, and the stdio smoke test (initialize + tools/list) and confirm all new tool names appear alongside the existing two. Commit any final wiring.

## Acceptance criteria
- All new operations + tools implemented with paths/params confirmed against the official models.
- Every tool handler returns `errorResult` on failure (never throws raw).
- Unit tests cover each operation (correct operation/method/path/query/body) and representative tool handlers (success + one error path).
- `npm test`, `npm run typecheck`, `npm run build`, and the smoke test all pass; smoke `tools/list` shows the full set.
