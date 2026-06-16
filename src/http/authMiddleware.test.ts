// src/http/authMiddleware.test.ts
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { DevJwtVerifier, mintDevJwt } from "../auth/verifier";
import { createAuthMiddleware } from "./authMiddleware";
import { protectedResourceMetadata } from "./metadata";

const SECRET = "middleware-test-secret-32-chars!!";
const RESOURCE_URI = "https://mcp.test/mcp";
const AUTH_SERVER = "https://auth.test";

function makeReqRes(headers: Record<string, string> = {}): {
  req: Partial<Request>;
  res: Partial<Response>;
  next: NextFunction;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const setHeader = vi.fn().mockReturnThis();
  const next = vi.fn() as unknown as NextFunction;

  const req = { headers } as unknown as Partial<Request>;
  const res = { status, json, setHeader } as unknown as Partial<Response>;
  return { req, res, next, status, json, setHeader };
}

describe("createAuthMiddleware", () => {
  const verifier = new DevJwtVerifier(SECRET);
  const middleware = createAuthMiddleware(verifier, RESOURCE_URI);

  it("returns 401 + WWW-Authenticate when Authorization header is absent", async () => {
    const { req, res, next, status, json, setHeader } = makeReqRes();
    await middleware(req as Request, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate",
      `Bearer resource_metadata="${RESOURCE_URI}/.well-known/oauth-protected-resource"`,
    );
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "unauthorized" }));
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 + WWW-Authenticate when Authorization header is malformed", async () => {
    const { req, res, next, status } = makeReqRes({ authorization: "NotBearer abc" });
    await middleware(req as Request, res as Response, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and sets req.authInfo when token is valid", async () => {
    const token = await mintDevJwt(SECRET, {
      sub: "seller-123",
      aud: RESOURCE_URI,
      scope: "seller:read",
    });
    const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });
    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as Request & { authInfo?: { sub: string } }).authInfo?.sub).toBe("seller-123");
  });

  it("returns 401 when token has wrong audience", async () => {
    const token = await mintDevJwt(SECRET, {
      sub: "seller-123",
      aud: "https://wrong.example.com",
      scope: "seller:read",
    });
    const { req, res, next, status } = makeReqRes({ authorization: `Bearer ${token}` });
    await middleware(req as Request, res as Response, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("protectedResourceMetadata", () => {
  it("returns a document with the correct shape", () => {
    const doc = protectedResourceMetadata(RESOURCE_URI, AUTH_SERVER);
    expect(doc.resource).toBe(RESOURCE_URI);
    expect(doc.authorization_servers).toContain(AUTH_SERVER);
    expect(doc.bearer_methods_supported).toContain("header");
    expect(Array.isArray(doc.scopes_supported)).toBe(true);
  });

  it("includes only the provided auth server URL", () => {
    const doc = protectedResourceMetadata(RESOURCE_URI, AUTH_SERVER);
    expect(doc.authorization_servers).toHaveLength(1);
    expect(doc.authorization_servers[0]).toBe(AUTH_SERVER);
  });
});
