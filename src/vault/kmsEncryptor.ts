// src/vault/kmsEncryptor.ts
//
// AWS KMS-backed encryptor.
//
// Required IAM on the caller role:
//   kms:Encrypt   — to encrypt plaintext
//   kms:Decrypt   — to decrypt ciphertext
//   kms:DescribeKey — optional, for key validation at startup
//
// Ciphertext blob: base64(KMS-returned CiphertextBlob).
// KMS Encrypt/Decrypt already includes authenticated encryption internally;
// no additional GCM tag is needed here.
//
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";
import type { Encryptor } from "./types";

/**
 * KMS-backed Encryptor. Uses KMS symmetric Encrypt/Decrypt.
 * The `keyId` can be a key ARN, alias ARN, or alias name.
 */
export class KmsEncryptor implements Encryptor {
  private readonly kms: KMSClient;

  constructor(
    private readonly keyId: string,
    kmsClient?: KMSClient,
  ) {
    this.kms = kmsClient ?? new KMSClient({});
  }

  async encrypt(plaintext: string): Promise<string> {
    const cmd = new EncryptCommand({
      KeyId: this.keyId,
      Plaintext: Buffer.from(plaintext, "utf8"),
    });
    const result = await this.kms.send(cmd);
    if (!result.CiphertextBlob) {
      throw new Error("KmsEncryptor: KMS returned empty CiphertextBlob");
    }
    return Buffer.from(result.CiphertextBlob).toString("base64");
  }

  async decrypt(ciphertext: string): Promise<string> {
    const ciphertextBlob = Buffer.from(ciphertext, "base64");
    const cmd = new DecryptCommand({
      KeyId: this.keyId,
      CiphertextBlob: ciphertextBlob,
    });
    const result = await this.kms.send(cmd);
    if (!result.Plaintext) {
      throw new Error("KmsEncryptor: KMS returned empty Plaintext");
    }
    return Buffer.from(result.Plaintext).toString("utf8");
  }
}
