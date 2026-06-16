// src/vault/localEncryptor.test.ts
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { LocalEncryptor } from "./localEncryptor";

function makeKey(): string {
  return randomBytes(32).toString("base64");
}

describe("LocalEncryptor", () => {
  it("round-trips a plaintext string", async () => {
    const enc = new LocalEncryptor(makeKey());
    const plaintext = "refresh_token_abc123";
    const blob = await enc.encrypt(plaintext);
    const recovered = await enc.decrypt(blob);
    expect(recovered).toBe(plaintext);
  });

  it("produces different ciphertext each call (random IV)", async () => {
    const enc = new LocalEncryptor(makeKey());
    const plaintext = "same_plaintext";
    const blob1 = await enc.encrypt(plaintext);
    const blob2 = await enc.encrypt(plaintext);
    expect(blob1).not.toBe(blob2);
  });

  it("throws on tampered blob", async () => {
    const enc = new LocalEncryptor(makeKey());
    const blob = await enc.encrypt("secret");
    // Flip a byte in the ciphertext region (after iv+tag = 28 bytes)
    const buf = Buffer.from(blob, "base64");
    buf[28] = buf[28]! ^ 0xff;
    const tampered = buf.toString("base64");
    await expect(enc.decrypt(tampered)).rejects.toThrow();
  });

  it("throws when key is wrong length", () => {
    const shortKey = randomBytes(16).toString("base64");
    expect(() => new LocalEncryptor(shortKey)).toThrow("32 bytes");
  });

  it("throws on blob too short to contain iv+tag", async () => {
    const enc = new LocalEncryptor(makeKey());
    const tinyBlob = Buffer.alloc(10).toString("base64");
    await expect(enc.decrypt(tinyBlob)).rejects.toThrow("too short");
  });
});
