// src/config.test.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

const base = {
  LWA_CLIENT_ID: "id",
  LWA_CLIENT_SECRET: "secret",
  SPAPI_REFRESH_TOKEN: "Atzr|token",
  SPAPI_MARKETPLACE_IDS: "ATVPDKIKX0DER,A2EUQ1WTGCTBG2",
};

describe("loadConfig", () => {
  it("parses a valid environment and defaults region to na and sandbox to false", () => {
    const cfg = loadConfig(base);
    expect(cfg.lwaClientId).toBe("id");
    expect(cfg.lwaClientSecret).toBe("secret");
    expect(cfg.refreshToken).toBe("Atzr|token");
    expect(cfg.region).toBe("na");
    expect(cfg.sandbox).toBe(false);
    expect(cfg.marketplaceIds).toEqual(["ATVPDKIKX0DER", "A2EUQ1WTGCTBG2"]);
  });

  it("reads sandbox=true and an explicit region", () => {
    const cfg = loadConfig({ ...base, SPAPI_SANDBOX: "true", SPAPI_REGION: "eu" });
    expect(cfg.sandbox).toBe(true);
    expect(cfg.region).toBe("eu");
  });

  it("throws when a required variable is missing", () => {
    const { LWA_CLIENT_ID, ...withoutId } = base;
    expect(() => loadConfig(withoutId)).toThrow(/LWA_CLIENT_ID/);
  });

  it("throws on an invalid region", () => {
    expect(() => loadConfig({ ...base, SPAPI_REGION: "mars" })).toThrow(/region/i);
  });

  it("parses SPAPI_SELLER_ID when present", () => {
    const cfg = loadConfig({ ...base, SPAPI_SELLER_ID: "A1B2C3D4E5F6G7" });
    expect(cfg.sellerId).toBe("A1B2C3D4E5F6G7");
  });

  it("leaves sellerId undefined when SPAPI_SELLER_ID is absent", () => {
    const cfg = loadConfig(base);
    expect(cfg.sellerId).toBeUndefined();
  });
});
