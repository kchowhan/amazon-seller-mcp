#!/usr/bin/env bash
# Dev-only smoke test launcher. NOT for production use.
export PORT=4321
export PUBLIC_URL=http://localhost:4321
export AUTH_SERVER_URL=https://auth.example.com
export SPAPI_APP_ID=amzn1.sellerapps.app.test
export LWA_CLIENT_ID=amzn1.application-oa2-client.test
export LWA_CLIENT_SECRET=test-secret
export SPAPI_VAULT_KEY=YjOG0xEh4U7LGdQM29Kuaz+zLf3o5ftA8p+Oqm+QXOE=
export AUTH_MODE=dev
export DEV_JWT_SECRET="dev-jwt-secret-at-least-32-chars!!"
export VAULT_BACKEND=memory
export DEV_SEED_USER_ID=dev-test-user
export DEV_SEED_REFRESH_TOKEN="Atzr|placeholder-refresh-token-for-smoke-test"
export DEV_SEED_MARKETPLACE_IDS=ATVPDKIKX0DER
exec node dist/httpServer.js
