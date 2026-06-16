// src/vault/localEncryptor.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Encryptor } from "./types";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM encryptor backed by a 32-byte key supplied as base64.
 * Blob format: base64(iv(12) || authTag(16) || ciphertext).
 * Caller should read the key from an env var (e.g. SPAPI_VAULT_KEY).
 */
export class LocalEncryptor implements Encryptor {
  private readonly key: Buffer;

  constructor(keyBase64: string) {
    this.key = Buffer.from(keyBase64, "base64");
    if (this.key.byteLength !== 32) {
      throw new Error(`LocalEncryptor: key must be 32 bytes; got ${this.key.byteLength}`);
    }
  }

  async encrypt(plaintext: string): Promise<string> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // blob = iv || tag || ciphertext
    const blob = Buffer.concat([iv, tag, encrypted]);
    return blob.toString("base64");
  }

  async decrypt(ciphertext: string): Promise<string> {
    let blob: Buffer;
    try {
      blob = Buffer.from(ciphertext, "base64");
    } catch {
      throw new Error("LocalEncryptor: invalid base64 blob");
    }
    const minLen = IV_BYTES + TAG_BYTES;
    if (blob.byteLength < minLen) {
      throw new Error("LocalEncryptor: blob too short");
    }
    const iv = blob.subarray(0, IV_BYTES);
    const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const encrypted = blob.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    try {
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      throw new Error("LocalEncryptor: decryption failed (tampered or wrong key)");
    }
  }
}
