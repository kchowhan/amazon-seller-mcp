# Amazon Selling Partner API MCP Server: Design

- Status: Approved design, pre-implementation
- Date: 2026-06-16
- Repo: amazon-seller-mcp
- Author: Kuldeep (with Claude)

## 1. Summary

A public, multi-tenant, remote-hosted MCP server that lets a seller drive their
Amazon Seller Central operations through an AI client (Claude and others) in
natural language. The server wraps the Amazon Selling Partner API (SP-API), the
programmatic backend behind Seller Central. It is built in Node/TypeScript,
hosted on AWS, targets the North America marketplace first, and is delivered in
phases with the PII-heavy capabilities and their compliance audit sequenced last.

"Seller Central" is the web portal. "SP-API" (formerly Amazon MWS, now retired)
is the API. The same API family also serves Vendor Central (1P); this project is
scoped to the 3P seller surface.

## 2. Goals and non-goals

### Goals
- Expose the full seller surface across four capability areas: listings and
  inventory, pricing and alerts, reports and finance, and orders and shipping.
- Be a real public product: other sellers connect their own Amazon account and
  use the server through their own AI client.
- Be compliant with Amazon's Data Protection Policy (DPP) so it can hold
  production access to restricted (PII) roles.
- Get usable value into Portar's own hands early, before the slow external
  approval gates clear.

### Non-goals (for now)
- Vendor Central / 1P APIs.
- Marketplaces outside North America (Europe and Far East are later additions).
- Amazon Advertising API (a separate API family with its own auth, out of scope).
- A web dashboard UI. The product surface is the MCP toolset; any UI is limited
  to the OAuth connect flow.

## 3. Key decisions (resolved during brainstorming)

| Decision | Choice | Why |
|---|---|---|
| Authorization scope | Public, multi-seller | Product, not a private script. |
| Capabilities | All four areas, incl. PII | Full seller surface requested. |
| Delivery | Remote hosted, multi-tenant | Sellers connect their AI client to one hosted server. |
| Stack and host | Node/TypeScript on AWS, bought auth/vault | Most mature MCP auth; AWS fits SP-API notifications and the DPP audit story. |
| Region | North America first | Avoids stacking GDPR/EU residency on top of the DPP early. |
| Sequencing | Phase the work, PII last | Ships usable value before the expensive audit gate. This is a sequence, not a scope cut. |

## 4. Background: verified SP-API realities

These facts were verified against Amazon developer docs in June 2026 and drive
the design. Sources in section 14.

### 4.1 Auth model (good news: simpler than legacy guides say)
- AWS Signature V4 signing and AWS IAM are no longer required. Amazon removed
  that requirement on 2 October 2023. Any lingering SigV4 signature is ignored.
- A request needs only a Login-with-Amazon (LWA) access token in the
  `x-amz-access-token` header (plus `host`, `x-amz-date`, `user-agent`).
- Token exchange at `https://api.amazon.com/auth/o2/token`:
  - `grant_type=refresh_token` for seller-authorized operations.
  - `grant_type=client_credentials` for grantless operations (e.g. notification
    destination management).
- Access token lifetime: 1 hour. Refresh token lifetime: 1 year. The OAuth
  authorization code (`spapi_oauth_code`) expires in 5 minutes.

### 4.2 App registration and authorization
- Register in the Solution Provider Portal as a public developer; the production
  app is listed in the Selling Partner Appstore.
- A draft app can be self-authorized against the developer's own seller account
  without publishing (this is the Phase 0 lever).
- Public authorization uses either the Appstore workflow or a website workflow
  ("Connect to Amazon"). Both land on the LWA consent screen and redirect back
  with `spapi_oauth_code`, which is exchanged for the 1-year refresh token.

### 4.3 Roles, restricted data, and RDT
- App access is gated by roles selected on the app. Most of Phase 1 uses
  non-restricted roles (Product Listing, Pricing, Inventory and Order Tracking,
  Finance and Accounting, Brand Analytics, Selling Partner Insights,
  Notifications).
- Four roles are restricted (PII) and require extra data-use/security review:
  Direct-to-Consumer Shipping, Professional Services, Tax Invoicing, Tax
  Remittance. Buyer messaging and solicitations use the Buyer Communication and
  Buyer Solicitation roles. The exact operation-to-role mapping is confirmed at
  Phase 2 onboarding against Amazon's roles page.
- Operations that return PII (orders with buyer info or shipping address,
  merchant fulfillment, restricted reports) are "restricted operations." To call
  them, first call `createRestrictedDataToken` (Tokens API) to mint a Restricted
  Data Token (RDT, 1-hour lifetime), scoped to specific paths and data elements,
  then send the RDT in `x-amz-access-token` instead of the normal access token.

### 4.4 Data Protection Policy (the dominant cost of the PII lane)
A public app holding restricted roles must pass a two-phase review (business
verification, then a data-security architecture review) and then operate under
the DPP, which is verified by audit:
- Encrypt PII in transit (TLS 1.2+) and at rest (AES-128 or RSA-2048+); rotate
  keys at least annually.
- Delete buyer PII within 30 days of order delivery; cap non-PII retention at
  18 months.
- Retain security logs at least 12 months.
- Report security incidents to Amazon within 24 hours; remediate critical
  vulnerabilities within 7 days, high-risk within 30 days.
- Maintain MFA, least privilege, and remove terminated-employee access within
  24 hours.
- Commission annual third-party security assessments and penetration tests, plus
  regular vulnerability scanning. This is a recurring money and vendor commitment.
- Amazon offers SP-API Guard, an automated AWS-config scanner, as a (non
  substitute) aid.

### 4.5 Rate limits
- Token-bucket per operation, scoped to the selling-partner-plus-application
  pair, and can vary by marketplace. Empty bucket returns HTTP 429 (retryable).
- The `x-amzn-RateLimit-Limit` response header reports the current limit but is
  best-effort and only present on some responses. Do not depend on it; implement
  client-side token-bucket accounting and exponential backoff on 429.

### 4.6 Notifications
- Real-time push via subscriptions delivered to Amazon SQS or AWS EventBridge.
- Destination management operations are grantless (`client_credentials`).
- Relevant types include `ANY_OFFER_CHANGED`, `ORDER_CHANGE`,
  `FBA_INVENTORY_AVAILABILITY_CHANGES`, `REPORT_PROCESSING_FINISHED`,
  `FEED_PROCESSING_FINISHED`, `PRICING_HEALTH`, `LISTINGS_ITEM_STATUS_CHANGE`.
- Every notification is delivered to a destination; there is no destination-free
  push.

### 4.7 SDKs and sandbox
- Amazon publishes OpenAPI/Swagger models at `amzn/selling-partner-api-models`
  and prebuilt SDKs (incl. JavaScript). We generate a typed client from the
  models rather than hand-writing endpoints.
- A sandbox environment (static and dynamic modes) allows testing without real
  seller data. Phase 0 also self-authorizes against Portar's real account for
  live validation.

## 5. Architecture

Two independent OAuth relationships. Keeping them separate is the central
security requirement; conflating them is the "confused deputy" hole the MCP spec
explicitly warns about.

```
[MCP client] --Leg 1: MCP OAuth 2.1--> [ YOUR MCP SERVER ] --Leg 2: LWA OAuth--> [Amazon SP-API]
  (Claude)     PKCE, audience-bound        |  per-seller          seller authorizes once;
               server = Resource Server    |  encrypted           code -> 1-yr refresh token
                                           |  TOKEN VAULT         -> 1-hr access token
                                           |                      + Restricted Data Token (PII)
              inbound MCP token  --X NEVER forwarded to Amazon X--
```

- Leg 1 (MCP client to your server): your server is an OAuth 2.1 Resource
  Server. Clients authenticate with PKCE; access tokens are audience-bound to
  your server's canonical URI (RFC 8707), discovered via Protected Resource
  Metadata (RFC 9728) and Authorization Server Metadata (RFC 8414). Target MCP
  spec revision 2025-11-25. Transport is Streamable HTTP (HTTP+SSE is
  deprecated).
- Leg 2 (your server to Amazon): your server is an OAuth client to LWA. Each
  seller authorizes once; the 1-year refresh token is stored encrypted in the
  per-seller vault, keyed to the MCP identity. Access tokens are minted per call;
  PII operations additionally mint an RDT.
- Hard rules: never forward the inbound MCP token to Amazon; keep a per-seller
  consent registry; bind sessions to user identity; validate token audience on
  every request.

## 6. Components

Each component has one clear purpose and a defined interface so it can be built
and tested in isolation.

1. SP-API client core
   - Purpose: a typed, resilient HTTP client for SP-API.
   - Responsibilities: LWA token exchange and refresh, RDT minting, NA endpoint
     routing, request signing-free auth headers, token-bucket rate limiting with
     429 backoff, typed request/response models generated from Amazon's OpenAPI
     models.
   - Interface: one typed method per supported operation; takes a seller context
     (which resolves credentials), returns typed results or typed errors.
   - Depends on: token vault (for credentials), the generated models.

2. Token vault
   - Purpose: secure per-seller credential storage.
   - Responsibilities: store and retrieve KMS-encrypted Amazon refresh tokens
     keyed to MCP identity; cache and refresh short-lived access tokens; never
     expose tokens to the MCP client.
   - Interface: `getAccessTokenForSeller(mcpUserId)`,
     `storeConnection(mcpUserId, refreshToken, roles, marketplaces)`,
     `revokeConnection(mcpUserId)`.
   - Depends on: AWS KMS, DynamoDB.

3. MCP server (Leg 1)
   - Purpose: speak MCP over Streamable HTTP and enforce auth.
   - Responsibilities: implement the Resource Server role, validate audience,
     expose the tool registry, resolve inbound identity to a seller connection,
     dispatch tool calls to the client core.
   - Interface: the MCP protocol surface plus an internal tool-registration API.
   - Depends on: auth layer, client core, tool layer.

4. Auth layer
   - Purpose: both OAuth relationships and their security controls.
   - Responsibilities: integrate the bought Authorization Server for Leg 1
     (DCR/PKCE/consent); implement the LWA authorization-code broker for Leg 2
     (capture `spapi_oauth_code`, exchange for refresh token, hand to vault);
     maintain the per-seller consent registry; implement confused-deputy
     mitigations (per-user approved client_id registry, exact redirect_uri
     match, CSRF-protected consent page, no token passthrough).
   - Interface: HTTP routes for the connect/callback flow plus middleware for the
     MCP server.
   - Depends on: bought AS vendor (chosen in Phase 1), token vault.

5. Notifications subsystem
   - Purpose: real-time alerts.
   - Responsibilities: manage SQS/EventBridge destinations (grantless) and
     per-seller subscriptions; consume delivered events; expose recent events to
     the tool layer.
   - Interface: subscription management methods plus an event store the
     `recent_alerts` tool reads.
   - Depends on: client core (Notifications API), AWS SQS/EventBridge, a store.

6. Tool layer
   - Purpose: the MCP tools themselves.
   - Responsibilities: thin, well-schema'd wrappers over client-core operations
     with structured output and good error messages.
   - Interface: MCP tool definitions (see section 7).
   - Depends on: client core, notifications subsystem.

7. AWS infrastructure
   - Purpose: hosting and the DPP control plane.
   - Responsibilities: Fargate or Lambda compute, KMS, Secrets Manager,
     DynamoDB, CloudTrail and CloudWatch with 12-month log retention, the
     30-day PII deletion job, network and IAM least privilege.

## 7. MCP tool surface

Curated high-value operations, not every endpoint. Each tool is a thin wrapper
over the named SP-API area. The set is extensible.

### Phase 1: cheap lane (non-PII)

Listings and inventory:
- `catalog_search` (Catalog Items): search Amazon catalog by keyword/identifier.
- `catalog_get_item` (Catalog Items): get catalog data for an ASIN.
- `listing_get` (Listings Items): get the seller's listing by SKU.
- `listing_put` (Listings Items): create or fully replace a listing.
- `listing_patch` (Listings Items): partial update (price, quantity, attributes).
- `listing_delete` (Listings Items): delete a listing.
- `product_type_get_schema` (Product Type Definitions): get the attribute schema
  for a product type (drives listing payloads).
- `inventory_get_fba` (FBA Inventory): FBA availability by SKU.
- `feed_submit` (Feeds): submit a bulk feed (batch price/inventory/listing).
- `feed_get_result` (Feeds): poll status and fetch the processing report.

Pricing and alerts:
- `pricing_get_competitive` (Product Pricing): competitive/featured-offer pricing.
- `pricing_get_item_offers` (Product Pricing): offers for an ASIN/SKU.
- `fees_estimate` (Product Fees): referral and fulfillment fee estimate.
- `notifications_subscribe` (Notifications): subscribe to a type (e.g.
  `ANY_OFFER_CHANGED`) to a destination.
- `notifications_list` / `notifications_delete` (Notifications): manage subs.
- `recent_alerts`: read recent delivered events from the notifications store.

Reports and finance:
- `report_request` (Reports): create a report.
- `report_get_document` (Reports): poll and download a completed report.
- `report_list_types`: helper enumerating common non-PII report types.
- `finance_list_events` (Finances): financial events (fees, refunds, adjustments).
- `sales_get_metrics` (Sales): order metrics over a time range.

Account:
- `sellers_get_marketplaces` (Sellers): marketplace participations.
- `connection_status`: which seller is connected and which roles are granted.

### Phase 2: PII lane (RDT + DPP)

- `orders_list` / `orders_get` (Orders): orders with buyer info via RDT.
- `order_get_items` (Orders): line items, with PII via RDT.
- `order_confirm_shipment` (Orders): confirm shipment.
- `fulfillment_get_rates` / `fulfillment_buy_label` (Merchant Fulfillment):
  rate shop and buy a shipping label.
- `messaging_send` (Messaging): permitted buyer-seller message.
- `solicitations_request_review` (Solicitations): request a review.

## 8. Data model (minimal)

- SellerConnection: `mcp_user_id`, `selling_partner_id`, `marketplace_ids`,
  `encrypted_refresh_token`, `granted_roles`, `created_at`, `updated_at`.
- ConsentRecord: `mcp_user_id`, `client_id`, `scopes`, `redirect_uri`,
  `granted_at`. Backs the confused-deputy defense.
- NotificationEvent (operational, short TTL): `mcp_user_id`, `type`, `payload`,
  `received_at`.
- Phase 2 PII: held ephemerally for the duration of a tool call only; never
  persisted beyond operational need; a scheduled job enforces 30-day deletion of
  anything that does touch storage.

## 9. Security and compliance

- Token handling: refresh tokens KMS-encrypted at rest, per-seller; access
  tokens cached in memory with short TTL; RDTs minted per PII call and never
  stored.
- Audience binding: validate that every inbound MCP token was issued for this
  server; reject otherwise (401).
- Confused-deputy mitigations: per-seller approved-client registry checked before
  any LWA forward; exact `redirect_uri` match; CSRF-protected, non-iframable
  consent page; single-use short-lived `state`.
- No token passthrough: the inbound MCP token is never sent to Amazon.
- DPP controls (Phase 2 gate): the full list in section 4.4, implemented with
  AWS-native primitives (KMS, CloudTrail, CloudWatch, GuardDuty) and validated
  with SP-API Guard before submission.

## 10. Phased delivery plan

### Phase 0: sandbox and self-authorized single-tenant tool layer
- Register a developer account and a draft app; self-authorize against Portar's
  own seller account.
- Build the SP-API client core (auth, refresh, rate limiting) and the Phase 1
  non-PII tools; test against the sandbox and Portar's real account.
- No MCP OAuth and no hosting yet. A local stdio MCP reading credentials from the
  environment is acceptable for this phase.
- Exit criteria: the cheap-lane tools work end to end against Portar's real
  account; client core has unit and contract tests passing.

### Phase 1: hosted multi-tenant, MCP OAuth, non-PII capabilities
- Choose the bought auth/vault vendor (Auth0 vs Stytch vs WorkOS) after a short
  eval.
- Stand up the remote MCP server (Streamable HTTP), Leg 1 Resource Server, the
  Leg 2 LWA broker, the token vault, and the AWS infrastructure.
- Ship listings/inventory, pricing/alerts, and non-PII reports/finance, plus
  notifications.
- Publish the app to the Appstore for non-restricted roles and pass the Phase 1
  security review.
- Exit criteria: a second test seller can connect and use the cheap-lane tools
  through their own AI client; app approved for non-restricted production access.

### Phase 2: PII lane and the Data Protection audit
- Add the restricted roles, RDT flow, and orders/shipping/messaging tools.
- Implement the full DPP control set and the 30-day PII deletion job.
- Commission the third-party security assessment and penetration test; run
  SP-API Guard; submit for the data-security review.
- Exit criteria: production access granted for restricted roles; PII tools live;
  audit evidence retained.

## 11. Testing strategy

- TDD on the client core: token refresh on expiry, RDT minting and scoping,
  token-bucket accounting, 429 backoff, error typing.
- Contract tests against the SP-API sandbox (static and dynamic modes).
- Auth-layer tests for the consent registry and the confused-deputy mitigations.
- Phase 0 live validation against Portar's real seller account.

## 12. Risks and open items

- External approval gates (Phase 1 security review; Phase 2 data-security review
  and audit) are the long pole and have no officially published timeline. The
  code can be finished well before Amazon clears each gate. Plan around this.
- Recurring DPP cost: annual third-party assessment and pen test are ongoing
  expenses, not one-time.
- Bought-auth vendor choice is deferred to Phase 1 (an owned decision, not a
  silent default).
- Unverified during research and to confirm at execution time: the exact
  PII-approval timeline; a rumored annual SP-API fee for 2026; the live maturity
  of the chosen SDK's auth primitives.

## 13. What this is not

A scope cut. All four capability areas ship. Phasing only changes the order so
that usable value lands before the slowest, most expensive gate.

## 14. References

SP-API:
- SigV4/IAM removal: https://developer-docs.amazon.com/sp-api/changelog/sp-api-will-no-longer-require-aws-iam-or-aws-signature-version-4
- Connecting to SP-API (tokens, headers): https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api
- Registration overview: https://developer-docs.amazon.com/sp-api/docs/sp-api-registration-overview
- Register as a public developer: https://developer-docs.amazon.com/sp-api/docs/register-as-a-public-developer
- Self-authorization: https://developer-docs.amazon.com/sp-api/docs/self-authorization
- Appstore authorization workflow: https://developer-docs.amazon.com/sp-api/docs/selling-partner-appstore-authorization-workflow
- Website authorization workflow: https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow
- Roles: https://developer-docs.amazon.com/sp-api/docs/roles-in-the-selling-partner-api
- Restricted Data Token: https://developer-docs.amazon.com/sp-api/docs/authorization-with-the-restricted-data-token
- Tokens API: https://developer-docs.amazon.com/sp-api/reference/tokens-v2021-03-01
- Key security controls (DPP): https://developer-docs.amazon.com/sp-api/docs/guidance-to-address-key-security-controls-in-sp-api-integration
- Security and compliance overview: https://developer-docs.amazon.com/sp-api/docs/security-compliance-overview
- Usage plans and rate limits: https://developer-docs.amazon.com/sp-api/docs/usage-plans-and-rate-limits
- Notifications use-case guide: https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide
- SDKs: https://developer-docs.amazon.com/sp-api/docs/sp-api-sdks
- OpenAPI models: https://github.com/amzn/selling-partner-api-models

MCP:
- Authorization (2025-11-25): https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- Transports (2025-11-25): https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- Security best practices: https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices
- Cloudflare workers-oauth-provider: https://github.com/cloudflare/workers-oauth-provider
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- RFC 9728 (Protected Resource Metadata): https://datatracker.ietf.org/doc/html/rfc9728
- RFC 8707 (Resource Indicators): https://www.rfc-editor.org/rfc/rfc8707.html
