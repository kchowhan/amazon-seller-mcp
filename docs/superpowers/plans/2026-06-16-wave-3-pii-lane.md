# Wave 3: PII Lane (Restricted Data Token)

> Ground every endpoint in Amazon's official OpenAPI model. Follow the established patterns (operations/*.ts, per-group MCP modules, register in server.ts). TDD throughout. These are the restricted (PII) operations gated behind a Restricted Data Token (RDT).

**Goal:** RDT minting in the transport + Tokens API, then Orders (incl. buyer PII), confirm shipment, Merchant Fulfillment, Messaging, and Solicitations.

**Model dirs (amzn/selling-partner-api-models):** `tokens-api-model` (tokens 2021-03-01), `orders-api-model` (orders v0), `merchant-fulfillment-api-model` (v0), `messaging-api-model` (v1), `solicitations-api-model` (v1).

---

## Task 1: RDT support in the transport + Tokens API

The Restricted Data Token (RDT) authorizes restricted operations that return PII. You mint an RDT (Tokens API, using a normal access token), scoped to specific resource paths + `dataElements`, then send the RDT in `x-amz-access-token` for the restricted call. RDT lifetime ~1 hour.

Changes to `src/client.ts`:
- Add to `RequestOptions`: `restrictedResources?: { method: string; path: string; dataElements?: string[] }[]`.
- Move token resolution to ONCE before the retry loop (currently it is inside the loop). Resolve in this priority:
  - if `options.restrictedResources` -> `token = await this.mintRdt(options.restrictedResources)`
  - else if `options.grantless` -> `getGrantlessToken(scope)`
  - else -> `getAccessToken()`
- Add `private async mintRdt(restrictedResources)`:
```ts
private async mintRdt(
  restrictedResources: NonNullable<RequestOptions["restrictedResources"]>,
): Promise<string> {
  const res = await this.request<{ restrictedDataToken: string; expiresIn: number }>({
    operation: "createRestrictedDataToken",
    method: "POST",
    path: "/tokens/2021-03-01/restrictedDataToken",
    body: { restrictedResources },
  });
  return res.restrictedDataToken;
}
```
This inner `request` has no `restrictedResources`, so it uses the normal access token (no recursion loop).

- [ ] TDD in `src/client.test.ts`: a request with `restrictedResources: [{method:"GET", path:"/orders/v0/orders", dataElements:["buyerInfo"]}]` first POSTs to `/tokens/2021-03-01/restrictedDataToken` (assert the mock fetch sees that path + body), receives `{restrictedDataToken:"RDT1", expiresIn:3600}`, then sends `x-amz-access-token: RDT1` on the actual GET. Use a fetch mock that branches on URL. Confirm existing retry/grantless/normal tests still pass (token now resolved before the loop). Commit.

## Task 2: Tokens operation wrapper (optional explicit helper)

`src/operations/tokens.ts`: export a thin `createRestrictedDataToken(client, restrictedResources)` that wraps the same call (useful for callers and for symmetry). The client's `mintRdt` is the internal path; this is the public op. Confirm path/body against `tokens-api-model`.

- [ ] TDD operation. Commit.

## Task 3: Orders (orders/v0) with RDT

`src/operations/orders.ts` (ground in `orders-api-model`):
- `getOrders`: GET `/orders/v0/orders`, query `MarketplaceIds` (required, PascalCase), plus optional `CreatedAfter`, `LastUpdatedAfter`, `OrderStatuses`, `NextToken`, `BuyerEmail`, etc. To include buyer PII, set `restrictedResources: [{ method: "GET", path: "/orders/v0/orders", dataElements: ["buyerInfo", "shippingAddress"] }]`.
- `getOrder`: GET `/orders/v0/orders/{orderId}` with `restrictedResources: [{ method:"GET", path:"/orders/v0/orders/{orderId}", dataElements:["buyerInfo","shippingAddress"] }]` (use the concrete path with the real orderId substituted in BOTH the request path and the restrictedResources path).
- `getOrderItems`: GET `/orders/v0/orders/{orderId}/orderItems` with `restrictedResources` `dataElements: ["buyerInfo"]`.
- `confirmShipment`: POST `/orders/v0/orders/{orderId}/shipmentConfirmation`, body per model (`marketplaceId`, `packageDetail`...). Check the model: if it is NOT a restricted operation, do not attach restrictedResources.

Tools (`src/mcp/tools/orders.ts`):
- `orders_list` (inputs: createdAfter? lastUpdatedAfter? orderStatuses[]? marketplaceIds default config; nextToken?)
- `orders_get` (input: orderId)
- `order_get_items` (input: orderId)
- `order_confirm_shipment` (inputs: orderId, marketplaceId default config, packageDetail object)

IMPORTANT for RDT scoping: the `path` in `restrictedResources` must match the request path (with the same path-parameter substitution). For `getOrder`/`getOrderItems`, build the concrete path string once and use it for both the request `path` and the restrictedResources `path`.

- [ ] TDD operations (assert path, query, AND restrictedResources/dataElements) + tools (success + error). Commit.

## Task 4: Merchant Fulfillment (merchantFulfillment/v0) with RDT

`src/operations/merchantFulfillment.ts` (ground in `merchant-fulfillment-api-model`; these handle buyer address PII -> restricted):
- `getEligibleShipmentServices`: POST `/mfn/v0/eligibleShippingServices`, body `{ ShipmentRequestDetails }`.
- `createShipment`: POST `/mfn/v0/shipments`, body `{ ShipmentRequestDetails, ShippingServiceId, ... }`.
Set `restrictedResources` per the model for these (confirm exact path + dataElements; typically `["shippingAddress"]` or `["buyerInfo"]`).

Tools (`src/mcp/tools/merchantFulfillment.ts`):
- `fulfillment_get_rates` (inputs: shipmentRequestDetails object) -> getEligibleShipmentServices
- `fulfillment_buy_label` (inputs: shipmentRequestDetails, shippingServiceId) -> createShipment

- [ ] TDD operations + tools. Commit.

## Task 5: Messaging (messaging/v1) with RDT

`src/operations/messaging.ts` (ground in `messaging-api-model`; restricted):
- `getMessagingActionsForOrder`: GET `/messaging/v1/orders/{amazonOrderId}`, query `marketplaceIds`. RDT-scoped.
- One representative send action confirmed in the model, e.g. `createConfirmDeliveryDetails`: POST `/messaging/v1/orders/{amazonOrderId}/messages/confirmDeliveryDetails`, query `marketplaceIds`, body `{ text }`. RDT-scoped.

Tools (`src/mcp/tools/messaging.ts`):
- `messaging_get_actions` (inputs: amazonOrderId, marketplaceIds default config)
- `messaging_confirm_delivery` (inputs: amazonOrderId, text, marketplaceIds default config)
Note in the tool descriptions that Amazon constrains buyer-seller messaging to specific permitted actions.

- [ ] TDD operations + tools. Commit.

## Task 6: Solicitations (solicitations/v1) with RDT

`src/operations/solicitations.ts` (ground in `solicitations-api-model`; restricted):
- `getSolicitationActionsForOrder`: GET `/solicitations/v1/orders/{amazonOrderId}`, query `marketplaceIds`.
- `createProductReviewAndSellerFeedbackSolicitation`: POST `/solicitations/v1/orders/{amazonOrderId}/solicitations/productReviewAndSellerFeedback`, query `marketplaceIds`.

Tools (`src/mcp/tools/solicitations.ts`):
- `solicitations_get_actions` (inputs: amazonOrderId, marketplaceIds default config)
- `solicitations_request_review` (inputs: amazonOrderId, marketplaceIds default config)

- [ ] TDD operations + tools. Commit.

## Task 7: Wire-up + verification

- [ ] Register all new groups in `server.ts`. Run `npm test`, `npm run typecheck`, `npm run build`, and the stdio smoke test; confirm new tool names appear. Commit final wiring.

## Acceptance criteria
- RDT minting works: restricted requests POST to the Tokens API first and use the RDT for the actual call; verified by test (URL-branching fetch mock).
- `restrictedResources.path` matches the actual request path (with the same path-param substitution).
- Paths/params/casing confirmed against the official models (Orders v0 uses PascalCase `MarketplaceIds`; Messaging/Solicitations use camelCase `marketplaceIds`).
- Every tool returns `errorResult` on failure. `npm test`/`typecheck`/`build`/smoke all green.
