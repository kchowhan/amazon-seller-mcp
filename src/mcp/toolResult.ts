// src/mcp/toolResult.ts
import type { SpApiConfig } from "../config";
import { SpApiError } from "../errors";

export interface ToolResult {
  // The MCP SDK's CallToolResult requires an index signature; this keeps ToolResult
  // structurally assignable to it without widening the meaningful fields.
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export function textResult(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function errorResult(err: unknown): ToolResult {
  const message =
    err instanceof SpApiError
      ? `${err.message}${err.code ? ` (${err.code})` : ""}`
      : err instanceof Error
        ? err.message
        : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

const SELLER_ID_ERROR =
  "sellerId is required: set SPAPI_SELLER_ID or pass sellerId as a tool argument";

export function resolveSellerOrError(
  argSellerId: string | undefined,
  configSellerId: string | undefined,
): { ok: true; sellerId: string } | { ok: false; result: ToolResult } {
  const sellerId = argSellerId ?? configSellerId;
  if (!sellerId) return { ok: false, result: errorResult(new Error(SELLER_ID_ERROR)) };
  return { ok: true, sellerId };
}
