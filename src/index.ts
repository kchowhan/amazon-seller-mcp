// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config";
import { resolveEndpoints } from "./endpoints";
import { LwaTokenClient } from "./auth/lwaTokenClient";
import { SpApiClient } from "./client";
import { buildServer } from "./mcp/server";

async function main(): Promise<void> {
  const config = loadConfig();
  const endpoints = resolveEndpoints(config.region, config.sandbox);
  const tokenClient = new LwaTokenClient(
    {
      lwaClientId: config.lwaClientId,
      lwaClientSecret: config.lwaClientSecret,
      refreshToken: config.refreshToken,
    },
    endpoints.lwaTokenUrl,
  );
  const client = new SpApiClient(endpoints, tokenClient);
  const server = buildServer(client, config);
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
