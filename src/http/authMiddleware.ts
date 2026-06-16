// src/http/authMiddleware.ts
import type { Request, Response, NextFunction } from "express";
import type { AuthVerifier, AuthInfo } from "../auth/verifier";

// Augment Express Request so downstream handlers can read req.authInfo.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authInfo?: AuthInfo;
    }
  }
}

/**
 * Express middleware factory. Extracts a Bearer token from the Authorization
 * header, verifies it via the injected AuthVerifier, and attaches the
 * resulting AuthInfo to req.authInfo.
 *
 * On failure, responds with 401 and:
 *   WWW-Authenticate: Bearer resource_metadata="<resourceUri>/.well-known/oauth-protected-resource"
 */
export function createAuthMiddleware(
  verifier: AuthVerifier,
  resourceUri: string,
): (req: Request, res: Response, next: NextFunction) => void {
  const wwwAuthenticate = `Bearer resource_metadata="${resourceUri}/.well-known/oauth-protected-resource"`;

  return async function authMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = extractBearer(authHeader);

    if (!token) {
      res.setHeader("WWW-Authenticate", wwwAuthenticate);
      res.status(401).json({ error: "unauthorized", error_description: "Bearer token required" });
      return;
    }

    try {
      const info = await verifier.verify(token, resourceUri);
      req.authInfo = info;
      next();
    } catch {
      // Keep error details out of the response; log nothing that contains the token.
      res.setHeader("WWW-Authenticate", wwwAuthenticate);
      res.status(401).json({ error: "unauthorized", error_description: "Invalid or expired token" });
    }
  };
}

function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : undefined;
}
