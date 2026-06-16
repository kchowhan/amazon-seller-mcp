// src/mcp/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { connectionStatusTool, sellersGetMarketplacesTool } from "./tools";
import type { SpApiClient } from "../client";
import type { SpApiConfig } from "../config";

const config: SpApiConfig = {
  lwaClientId: "id",
  lwaClientSecret: "secret",
  refreshToken: "rt",
  region: "na",
  marketplaceIds: ["ATVPDKIKX0DER"],
  sandbox: true,
};

describe("connectionStatusTool", () => {
  it("returns the configured region, sandbox flag, and marketplaces as text", async () => {
    const result = await connectionStatusTool(config);
    const text = result.content[0]!.text;
    expect(text).toContain("\"region\": \"na\"");
    expect(text).toContain("\"sandbox\": true");
    expect(text).toContain("ATVPDKIKX0DER");
  });
});

describe("sellersGetMarketplacesTool", () => {
  it("serializes the marketplace participations from the client", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: [
        {
          marketplace: { id: "ATVPDKIKX0DER", name: "Amazon.com", countryCode: "US" },
          participation: { isParticipating: true, hasSuspendedListings: false },
        },
      ],
    });
    const client = { request } as unknown as SpApiClient;

    const result = await sellersGetMarketplacesTool(client);
    expect(result.content[0]!.text).toContain("Amazon.com");
  });
});
