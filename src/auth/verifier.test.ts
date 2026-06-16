// src/auth/verifier.test.ts
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { DevJwtVerifier, mintDevJwt } from "./verifier";

const SECRET = "test-secret-key-at-least-32-chars!!";
const RESOURCE_URI = "https://mcp.example.com/mcp";

function secretBytes(): Uint8Array {
  return new TextEncoder().encode(SECRET);
}

async function mintToken(opts: {
  aud?: string | string[];
  sub?: string;
  scope?: string;
  expiresIn?: string;
  signWith?: string; // different secret for bad-sig tests
}): Promise<string> {
  const key = new TextEncoder().encode(opts.signWith ?? SECRET);
  let builder = new SignJWT({ scope: opts.scope ?? "seller:read" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.sub ?? "user-abc")
    .setAudience(opts.aud ?? RESOURCE_URI)
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h");
  return builder.sign(key);
}

describe("DevJwtVerifier", () => {
  it("verifies a valid signed token and returns sub + scopes", async () => {
    const verifier = new DevJwtVerifier(SECRET);
    const token = await mintToken({ scope: "seller:read seller:write" });
    const info = await verifier.verify(token, RESOURCE_URI);
    expect(info.sub).toBe("user-abc");
    expect(info.scopes).toEqual(["seller:read", "seller:write"]);
  });

  it("rejects a token with a wrong audience", async () => {
    const verifier = new DevJwtVerifier(SECRET);
    const token = await mintToken({ aud: "https://other.example.com" });
    await expect(verifier.verify(token, RESOURCE_URI)).rejects.toThrow();
  });

  it("rejects a token signed with a different secret (bad signature)", async () => {
    const verifier = new DevJwtVerifier(SECRET);
    const token = await mintToken({ signWith: "a-completely-different-secret-!!" });
    await expect(verifier.verify(token, RESOURCE_URI)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const verifier = new DevJwtVerifier(SECRET);
    // Sign a token that expired 1 second ago
    const key = secretBytes();
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ scope: "seller:read" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-abc")
      .setAudience(RESOURCE_URI)
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 1)
      .sign(key);
    await expect(verifier.verify(token, RESOURCE_URI)).rejects.toThrow();
  });

  it("returns empty scopes when scope claim is absent", async () => {
    const key = secretBytes();
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-abc")
      .setAudience(RESOURCE_URI)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    const verifier = new DevJwtVerifier(SECRET);
    const info = await verifier.verify(token, RESOURCE_URI);
    expect(info.scopes).toEqual([]);
  });

  it("mintDevJwt helper produces a verifiable token", async () => {
    const token = await mintDevJwt(SECRET, {
      sub: "seller-99",
      aud: RESOURCE_URI,
      scope: "seller:read",
    });
    const verifier = new DevJwtVerifier(SECRET);
    const info = await verifier.verify(token, RESOURCE_URI);
    expect(info.sub).toBe("seller-99");
    expect(info.scopes).toContain("seller:read");
  });
});
