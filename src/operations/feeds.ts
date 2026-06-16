// src/operations/feeds.ts
// Feeds API 2021-06-30
// Model: feeds_2021-06-30.json
import type { SpApiClient } from "../client";

// Rate limits per SP-API docs: createFeedDocument 0.5/s burst 15, createFeed 0.0083/s burst 15,
// getFeed 2/s burst 15, getFeedDocument 0.5/s burst 15.
const CREATE_DOC_RATE = { rate: 0.5, burst: 15 };
const CREATE_FEED_RATE = { rate: 0.0083, burst: 15 };
const GET_FEED_RATE = { rate: 2, burst: 15 };
const GET_FEED_DOC_RATE = { rate: 0.5, burst: 15 };

export interface CreateFeedDocumentResponse {
  feedDocumentId: string;
  url: string;
}

export interface CreateFeedResponse {
  feedId: string;
}

export interface Feed {
  feedId: string;
  feedType: string;
  processingStatus: "CANCELLED" | "DONE" | "FATAL" | "IN_PROGRESS" | "IN_QUEUE";
  createdTime: string;
  marketplaceIds?: string[];
  processingStartTime?: string;
  processingEndTime?: string;
  resultFeedDocumentId?: string;
}

export interface FeedDocument {
  feedDocumentId: string;
  url: string;
  compressionAlgorithm?: "GZIP";
}

export async function createFeedDocument(
  client: SpApiClient,
  contentType: string,
): Promise<CreateFeedDocumentResponse> {
  return client.request<CreateFeedDocumentResponse>({
    operation: "createFeedDocument",
    method: "POST",
    path: "/feeds/2021-06-30/documents",
    body: { contentType },
    rateLimit: CREATE_DOC_RATE,
  });
}

export async function createFeed(
  client: SpApiClient,
  params: {
    feedType: string;
    marketplaceIds: string[];
    inputFeedDocumentId: string;
    feedOptions?: Record<string, string>;
  },
): Promise<CreateFeedResponse> {
  return client.request<CreateFeedResponse>({
    operation: "createFeed",
    method: "POST",
    path: "/feeds/2021-06-30/feeds",
    body: {
      feedType: params.feedType,
      marketplaceIds: params.marketplaceIds,
      inputFeedDocumentId: params.inputFeedDocumentId,
      feedOptions: params.feedOptions,
    },
    rateLimit: CREATE_FEED_RATE,
  });
}

export async function getFeed(client: SpApiClient, feedId: string): Promise<Feed> {
  return client.request<Feed>({
    operation: "getFeed",
    method: "GET",
    path: `/feeds/2021-06-30/feeds/${feedId}`,
    rateLimit: GET_FEED_RATE,
  });
}

export async function getFeedDocument(
  client: SpApiClient,
  feedDocumentId: string,
): Promise<FeedDocument> {
  return client.request<FeedDocument>({
    operation: "getFeedDocument",
    method: "GET",
    path: `/feeds/2021-06-30/documents/${feedDocumentId}`,
    rateLimit: GET_FEED_DOC_RATE,
  });
}
