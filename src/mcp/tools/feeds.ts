// src/mcp/tools/feeds.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import type { FetchLike } from "../../auth/lwaTokenClient";
import { createFeedDocument, createFeed, getFeed, getFeedDocument } from "../../operations/feeds";
import { uploadDocument, downloadDocument } from "../../operations/documents";
import { textResult, errorResult, type ToolResult } from "../toolResult";

const DEFAULT_CONTENT_TYPE = "text/tab-separated-values; charset=UTF-8";
const MAX_CONTENT_CHARS = 50_000;

export async function feedSubmitTool(
  client: SpApiClient,
  config: SpApiConfig,
  args: {
    feedType: string;
    content: string;
    contentType?: string;
    marketplaceIds?: string[];
  },
  fetchFn: FetchLike = fetch,
): Promise<ToolResult> {
  try {
    const contentType = args.contentType ?? DEFAULT_CONTENT_TYPE;
    const marketplaceIds = args.marketplaceIds ?? config.marketplaceIds;

    const { feedDocumentId, url } = await createFeedDocument(client, contentType);
    await uploadDocument(url, args.content, contentType, fetchFn);
    const { feedId } = await createFeed(client, {
      feedType: args.feedType,
      marketplaceIds,
      inputFeedDocumentId: feedDocumentId,
    });
    return textResult({ feedId, feedDocumentId });
  } catch (err) {
    return errorResult(err);
  }
}

export async function feedGetResultTool(
  client: SpApiClient,
  args: { feedId: string },
  fetchFn: FetchLike = fetch,
): Promise<ToolResult> {
  try {
    const feed = await getFeed(client, args.feedId);
    if (feed.processingStatus !== "DONE") {
      return textResult({ processingStatus: feed.processingStatus, feedId: feed.feedId });
    }
    if (!feed.resultFeedDocumentId) {
      return textResult({ processingStatus: "DONE", feedId: feed.feedId, resultFeedDocumentId: null });
    }
    const doc = await getFeedDocument(client, feed.resultFeedDocumentId);
    const content = await downloadDocument(doc.url, doc.compressionAlgorithm, fetchFn);
    const truncated = content.length > MAX_CONTENT_CHARS;
    return textResult({
      feedId: feed.feedId,
      resultFeedDocumentId: feed.resultFeedDocumentId,
      truncated,
      content: truncated ? content.slice(0, MAX_CONTENT_CHARS) + "\n[truncated]" : content,
    });
  } catch (err) {
    return errorResult(err);
  }
}

export function registerFeedsTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "feed_submit",
    {
      description:
        "Submit a feed to Amazon. Creates a feed document, uploads content to the presigned URL, then creates the feed. Returns feedId to poll with feed_get_result. marketplaceIds defaults to the configured marketplaces.",
      inputSchema: {
        feedType: z.string().describe("Feed type identifier (e.g. POST_PRODUCT_DATA)"),
        content: z.string().describe("Feed content (TSV or XML depending on feedType)"),
        contentType: z
          .string()
          .optional()
          .describe(
            `Content-Type of the feed (default: "${DEFAULT_CONTENT_TYPE}")`,
          ),
        marketplaceIds: z
          .array(z.string())
          .optional()
          .describe("Marketplace IDs (defaults to configured marketplaces)"),
      },
    },
    async (args) => feedSubmitTool(client, config, args),
  );

  server.registerTool(
    "feed_get_result",
    {
      description:
        "Check the status of a submitted feed and, when DONE, download and return the processing report (first 50k chars). Returns processingStatus if not yet complete.",
      inputSchema: {
        feedId: z.string().describe("The feedId returned by feed_submit"),
      },
    },
    async (args) => feedGetResultTool(client, args),
  );
}
