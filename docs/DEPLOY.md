# Deployment Guide: amazon-seller-mcp (Hosted Multi-Tenant Mode)

This guide covers deploying the hosted HTTP server (`dist/httpServer.js`). For the
local single-tenant stdio mode, see the README.

## Environment Variables

All variables must be set before the container starts.

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: 3000) | Port the HTTP server listens on. |
| `PUBLIC_URL` | Yes | Publicly reachable base URL with no trailing slash, e.g. `https://mcp.example.com`. |
| `AUTH_SERVER_URL` | Yes | OAuth Authorization Server URL, e.g. `https://auth.example.com`. Served in RFC 9728 metadata. |
| `SPAPI_APP_ID` | Yes | Amazon SP-API application ID (from Seller Central developer console). |
| `LWA_CLIENT_ID` | Yes | LWA application client ID. |
| `LWA_CLIENT_SECRET` | Yes | LWA application client secret. Store in a secrets manager, not plain env. |
| `SPAPI_VAULT_KEY` | Yes | 32-byte base64-encoded AES-256-GCM key for local encryptor. Generate with `openssl rand -base64 32`. Store in KMS or secrets manager. |
| `SPAPI_REGION` | No (default: `na`) | SP-API region: `na`, `eu`, or `fe`. |
| `SPAPI_SANDBOX` | No (default: `false`) | Set `true` to route all SP-API calls to the sandbox endpoints. |
| `VAULT_BACKEND` | No (default: `dynamo`) | `dynamo` for production DynamoDB, `memory` for dev/test only. |
| `AUTH_MODE` | No (default: `jwks`) | `jwks` for production JWKS verification, `dev` for HS256 dev JWT (never in prod). |
| `JWKS_URI` | Yes (if `AUTH_MODE=jwks`) | JWKS endpoint of your authorization server, e.g. `https://auth.example.com/.well-known/jwks.json`. |
| `JWT_ISSUER` | Yes (if `AUTH_MODE=jwks`) | Expected `iss` claim in inbound JWTs. |
| `DEV_JWT_SECRET` | Yes (if `AUTH_MODE=dev`) | HS256 secret for local dev JWTs. Must never be set in production. |
| `DEV_SEED_USER_ID` | No | Dev only: mcpUserId to pre-populate in the in-memory vault on startup. |
| `DEV_SEED_REFRESH_TOKEN` | No | Dev only: plaintext refresh token for `DEV_SEED_USER_ID`. |
| `DEV_SEED_MARKETPLACE_IDS` | No | Dev only: comma-separated marketplace IDs for the seeded connection. |
| `DEFAULT_MARKETPLACE_IDS` | No (default: `ATVPDKIKX0DER`) | Comma-separated marketplace IDs used when a seller connection has an empty `marketplaceIds` list. Defaults to the US marketplace. Set to match your primary region (e.g. `A1F83G8C2ARO7P` for UK). |
| `SPAPI_SQS_QUEUE_URL` | No | SQS queue URL for the notification consumer (see Notifications section). |

---

## AWS Resources

### DynamoDB Table (Token Vault)

The vault stores encrypted seller refresh tokens.

- **Table name**: e.g. `amazon-seller-mcp-vault` (configure in your vault adapter)
- **Partition key**: `mcpUserId` (String)
- **Attributes**: `mcpUserId`, `encryptedRefreshToken` (AES-KMS encrypted base64 String),
  `sellingPartnerId` (String, optional), `marketplaceIds` (L — DynamoDB List of String,
  **not** StringSet), `grantedRoles` (L — List of String, optional), `createdAt` (Number),
  `updatedAt` (Number).
  > **Note**: `marketplaceIds` and `grantedRoles` are stored as DynamoDB **List (`L`)**, not
  > StringSet (`SS`). List is used deliberately because StringSet cannot store an empty set,
  > but a freshly-connected seller may have zero marketplace IDs until populated via the
  > account API.
- **Billing**: On-demand recommended (traffic is bursty per OAuth connect)
- **Encryption**: Enable SSE with a customer-managed KMS key (see below)
- **TTL**: Optional; enable on `updatedAt` + offset if you want inactive token auto-expiry

IAM permissions required for the server role/task:
```json
{
  "Action": [
    "dynamodb:GetItem",
    "dynamodb:PutItem",
    "dynamodb:DeleteItem",
    "dynamodb:Scan"
  ],
  "Resource": "arn:aws:dynamodb:<region>:<account>:table/amazon-seller-mcp-vault"
}
```

### KMS Key (Vault Encryption)

Used by `KmsEncryptor` to encrypt refresh tokens before writing to DynamoDB.

- **Key type**: Symmetric (AES-256 / SYMMETRIC_DEFAULT)
- **Key usage**: Encrypt and decrypt
- **Key alias**: e.g. `alias/amazon-seller-mcp-vault`
- **Key policy**: grant your server role `kms:Encrypt` and `kms:Decrypt`

IAM permissions for the server role:
```json
{
  "Action": ["kms:Encrypt", "kms:Decrypt"],
  "Resource": "arn:aws:kms:<region>:<account>:key/<key-id>"
}
```

### SQS Queue (Notifications Consumer)

For receiving SP-API event notifications (ORDER_CHANGE, ANY_OFFER_CHANGED, etc.).

- **Queue type**: Standard (SP-API does not support FIFO queues)
- **Message retention**: 4 days recommended
- **Visibility timeout**: 30 seconds (longer than your max processing time)
- **Dead-letter queue**: Attach a DLQ for messages that fail after 3 receives

Queue resource policy (allows SP-API to send):
```json
{
  "Effect": "Allow",
  "Principal": { "Service": "mws.amazonservices.com" },
  "Action": "SQS:SendMessage",
  "Resource": "arn:aws:sqs:<region>:<account>:amazon-seller-mcp-notifications"
}
```

IAM permissions for the server role (consumer):
```json
{
  "Action": [
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:GetQueueAttributes"
  ],
  "Resource": "arn:aws:sqs:<region>:<account>:amazon-seller-mcp-notifications"
}
```

Set `SPAPI_SQS_QUEUE_URL` to the queue URL to enable the consumer. Architecture note:
one queue per seller (each seller points their SP-API notification destination to a
separate queue) is simpler and avoids cross-tenant message routing ambiguity.

---

## Pointing an MCP Client at the Hosted Server

The server implements the MCP Streamable HTTP transport with OAuth 2.1 bearer token auth.

1. Your MCP client must obtain a bearer token from your Authorization Server
   (audience: `<PUBLIC_URL>/mcp`).
2. Configure the client:
   - **URL**: `https://mcp.example.com/mcp`
   - **Authorization**: `Bearer <token>`
3. On first use, if the seller has not connected their Amazon account, the server
   returns `403 seller_not_connected`. Direct the seller to:
   `GET https://mcp.example.com/connect` (with a valid bearer token).
4. The `/connect` flow redirects to Amazon LWA consent, then back to `/callback`,
   which stores the encrypted refresh token in the vault. Subsequent MCP requests
   will resolve the seller's connection automatically.

The server publishes RFC 9728 Protected Resource Metadata at:
`GET https://mcp.example.com/.well-known/oauth-protected-resource`

This allows MCP clients to discover the Authorization Server automatically.

---

## Data Protection Policy Operational Checklist

The following controls are required before accepting real seller data in production.
Each item is an operational TODO, not a code change.

- [ ] **TLS**: Terminate TLS at your load balancer or CDN. Never expose port 3000
  directly. Use TLS 1.2+ only; disable older versions.
- [ ] **AES/KMS at rest**: Enable DynamoDB SSE with a customer-managed KMS key (see
  above). Rotate the KMS key annually. Confirm `KmsEncryptor` is wired instead of
  `LocalEncryptor` in production.
- [ ] **30-day PII deletion**: Implement a scheduled job to call `vault.revokeConnection`
  for any seller who has not re-authorized within 30 days, or honor explicit DELETE
  requests from sellers. Log revocations for audit.
- [ ] **12-month log retention**: Configure CloudWatch Logs (or your logging destination)
  with a 12-month (365-day) retention policy. Include request IDs and mcpUserId in
  structured log lines. Do NOT log refresh tokens or bearer tokens.
- [ ] **24-hour incident reporting**: Establish a runbook and on-call rotation for
  suspected credential exposure. Revoke affected tokens within 24 hours and notify
  affected sellers.
- [ ] **Annual pen test / security audit**: Schedule a third-party penetration test
  annually. Review IAM policies, DynamoDB access patterns, and the LWA broker flow
  (state token expiry, redirect_uri exactness, confused-deputy mitigations).
- [ ] **Scope minimization**: Grant the SP-API application only the roles/scopes
  required for your tool set. Review grantless vs. seller-authorized operations.
- [ ] **Secret rotation**: Rotate `LWA_CLIENT_SECRET` and `SPAPI_VAULT_KEY` on a
  scheduled basis. Use your secrets manager (AWS Secrets Manager recommended).
