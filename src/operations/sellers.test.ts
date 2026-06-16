// src/operations/sellers.test.ts
import { describe, it, expect, vi } from "vitest";
import { getMarketplaceParticipations } from "./sellers";
import type { SpApiClient } from "../client";

describe("getMarketplaceParticipations", () => {
  it("calls the marketplaceParticipations operation and returns the payload array", async () => {
    const request = vi.fn().mockResolvedValue({
      payload: [
        {
          marketplace: { id: "ATVPDKIKX0DER", name: "Amazon.com", countryCode: "US" },
          participation: { isParticipating: true, hasSuspendedListings: false },
        },
      ],
    });
    const client = { request } as unknown as SpApiClient;

    const result = await getMarketplaceParticipations(client);

    expect(result).toHaveLength(1);
    expect(result[0]!.marketplace.id).toBe("ATVPDKIKX0DER");
    const callArg = request.mock.calls[0]![0];
    expect(callArg.operation).toBe("getMarketplaceParticipations");
    expect(callArg.method).toBe("GET");
    expect(callArg.path).toBe("/sellers/v1/marketplaceParticipations");
  });
});
