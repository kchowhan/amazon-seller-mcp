// src/operations/productTypes.test.ts
import { describe, it, expect, vi } from "vitest";
import type { SpApiClient } from "../client";
import { getDefinitionsProductType } from "./productTypes";

function makeClient(returnValue: unknown) {
  return { request: vi.fn().mockResolvedValue(returnValue) } as unknown as SpApiClient;
}

describe("getDefinitionsProductType", () => {
  it("calls correct operation, method, path and query with required params", async () => {
    const client = makeClient({ productType: "SHIRT", schema: {} });
    await getDefinitionsProductType(client, {
      productType: "SHIRT",
      marketplaceIds: ["ATVPDKIKX0DER"],
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.operation).toBe("getDefinitionsProductType");
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/definitions/2020-09-01/productTypes/SHIRT");
    expect(opts.query.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
  });

  it("passes optional requirements and locale when supplied", async () => {
    const client = makeClient({ productType: "SHIRT", schema: {} });
    await getDefinitionsProductType(client, {
      productType: "SHIRT",
      marketplaceIds: ["ATVPDKIKX0DER"],
      requirements: "LISTING",
      locale: "en_US",
    });

    const opts = (client.request as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(opts.query.requirements).toBe("LISTING");
    expect(opts.query.locale).toBe("en_US");
  });
});
