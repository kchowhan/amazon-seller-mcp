// src/http/metadata.ts
// RFC 9728: OAuth 2.0 Protected Resource Metadata

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
}

/**
 * Build the RFC 9728 Protected Resource Metadata document for this server.
 *
 * @param resourceUri    - The canonical URI of the MCP resource server (e.g. https://mcp.example.com/mcp).
 * @param authServerUrl  - The authorization server URL (e.g. https://auth.example.com).
 */
export function protectedResourceMetadata(
  resourceUri: string,
  authServerUrl: string,
): ProtectedResourceMetadata {
  return {
    resource: resourceUri,
    authorization_servers: [authServerUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: ["seller:read", "seller:write"],
  };
}
