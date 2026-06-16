// src/endpoints.test.ts
import { describe, it, expect } from "vitest";
import { resolveEndpoints } from "./endpoints";

describe("resolveEndpoints", () => {
  it("returns the NA production base URL when sandbox is false", () => {
    const e = resolveEndpoints("na", false);
    expect(e.spApiBaseUrl).toBe("https://sellingpartnerapi-na.amazon.com");
    expect(e.lwaTokenUrl).toBe("https://api.amazon.com/auth/o2/token");
  });

  it("returns the NA sandbox base URL when sandbox is true", () => {
    const e = resolveEndpoints("na", true);
    expect(e.spApiBaseUrl).toBe("https://sandbox.sellingpartnerapi-na.amazon.com");
  });

  it("returns the EU and FE production hosts", () => {
    expect(resolveEndpoints("eu", false).spApiBaseUrl).toBe(
      "https://sellingpartnerapi-eu.amazon.com",
    );
    expect(resolveEndpoints("fe", false).spApiBaseUrl).toBe(
      "https://sellingpartnerapi-fe.amazon.com",
    );
  });
});
