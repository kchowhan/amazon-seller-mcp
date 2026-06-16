// src/auth/verifier.ts
import {
  SignJWT,
  jwtVerify,
  createRemoteJWKSet,
  type JWTPayload,
} from "jose";

export interface AuthInfo {
  sub: string;
  scopes: string[];
}

export interface AuthVerifier {
  verify(bearerToken: string, resourceUri: string): Promise<AuthInfo>;
}

/**
 * DevJwtVerifier: validates HS256 JWTs signed with a shared secret.
 * For local development and tests ONLY. Never use in production.
 */
export class DevJwtVerifier implements AuthVerifier {
  private readonly secretBytes: Uint8Array;

  constructor(secret: string) {
    this.secretBytes = new TextEncoder().encode(secret);
  }

  async verify(bearerToken: string, resourceUri: string): Promise<AuthInfo> {
    const { payload } = await jwtVerify(bearerToken, this.secretBytes, {
      algorithms: ["HS256"],
      audience: resourceUri,
    });

    const sub = payload.sub;
    if (!sub) {
      throw new Error("JWT missing sub claim");
    }

    const scopes = extractScopes(payload);
    return { sub, scopes };
  }
}

/**
 * JwksVerifier: validates RS256 JWTs from a real authorization server.
 * Production adapter. Type-checked only; no unit tests needed.
 */
export class JwksVerifier implements AuthVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    jwksUri: string,
    private readonly issuer: string,
  ) {
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  async verify(bearerToken: string, resourceUri: string): Promise<AuthInfo> {
    const { payload } = await jwtVerify(bearerToken, this.jwks, {
      algorithms: ["RS256"],
      audience: resourceUri,
      issuer: this.issuer,
    });

    const sub = payload.sub;
    if (!sub) {
      throw new Error("JWT missing sub claim");
    }

    const scopes = extractScopes(payload);
    return { sub, scopes };
  }
}

function extractScopes(payload: JWTPayload): string[] {
  const raw = (payload as Record<string, unknown>)["scope"];
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(" ");
  }
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  return [];
}

// Helper exported for tests: mint a dev JWT without re-importing jose everywhere.
export async function mintDevJwt(
  secret: string,
  payload: {
    sub: string;
    aud: string | string[];
    scope?: string;
    expiresIn?: string; // e.g. "1h"
    notBefore?: number; // seconds from now
  },
): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret);
  let builder = new SignJWT({ scope: payload.scope ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setAudience(payload.aud)
    .setIssuedAt()
    .setExpirationTime(payload.expiresIn ?? "1h");

  return builder.sign(secretBytes);
}
