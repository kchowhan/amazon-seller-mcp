// src/mcp/tools/notifications.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpApiClient } from "../../client";
import type { SpApiConfig } from "../../config";
import {
  getDestinations,
  createDestination,
  deleteDestination,
  createSubscription,
  getSubscription,
  deleteSubscriptionById,
} from "../../operations/notifications";
import { textResult, errorResult, type ToolResult } from "../toolResult";

export async function notificationsCreateDestinationTool(
  client: SpApiClient,
  _config: SpApiConfig,
  args: {
    name: string;
    sqsArn?: string;
    eventBridgeRegion?: string;
    eventBridgeAccountId?: string;
  },
): Promise<ToolResult> {
  try {
    const resourceSpecification: {
      sqs?: { arn: string };
      eventBridge?: { region: string; accountId: string };
    } = {};
    if (args.sqsArn) {
      resourceSpecification.sqs = { arn: args.sqsArn };
    }
    if (args.eventBridgeRegion && args.eventBridgeAccountId) {
      resourceSpecification.eventBridge = {
        region: args.eventBridgeRegion,
        accountId: args.eventBridgeAccountId,
      };
    }
    const result = await createDestination(client, {
      name: args.name,
      resourceSpecification,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function notificationsListDestinationsTool(
  client: SpApiClient,
): Promise<ToolResult> {
  try {
    const result = await getDestinations(client);
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function notificationsDeleteDestinationTool(
  client: SpApiClient,
  args: { destinationId: string },
): Promise<ToolResult> {
  try {
    await deleteDestination(client, args.destinationId);
    return textResult({ deleted: true, destinationId: args.destinationId });
  } catch (err) {
    return errorResult(err);
  }
}

export async function notificationsSubscribeTool(
  client: SpApiClient,
  args: {
    notificationType: string;
    destinationId: string;
    payloadVersion?: string;
  },
): Promise<ToolResult> {
  try {
    const result = await createSubscription(client, args.notificationType, {
      payloadVersion: args.payloadVersion ?? "1.0",
      destinationId: args.destinationId,
    });
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function notificationsGetSubscriptionTool(
  client: SpApiClient,
  args: { notificationType: string },
): Promise<ToolResult> {
  try {
    const result = await getSubscription(client, args.notificationType);
    return textResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function notificationsUnsubscribeTool(
  client: SpApiClient,
  args: { notificationType: string; subscriptionId: string },
): Promise<ToolResult> {
  try {
    await deleteSubscriptionById(client, args.notificationType, args.subscriptionId);
    return textResult({ unsubscribed: true, notificationType: args.notificationType, subscriptionId: args.subscriptionId });
  } catch (err) {
    return errorResult(err);
  }
}

export function registerNotificationsTools(
  server: McpServer,
  client: SpApiClient,
  config: SpApiConfig,
): void {
  server.registerTool(
    "notifications_create_destination",
    {
      description:
        "Create an Amazon notification destination (SQS queue or EventBridge). Provide sqsArn for SQS, or eventBridgeRegion + eventBridgeAccountId for EventBridge. Uses grantless token.",
      inputSchema: {
        name: z.string().describe("Developer-defined name for the destination"),
        sqsArn: z
          .string()
          .optional()
          .describe("ARN of the SQS queue (e.g. arn:aws:sqs:us-east-1:123456789012:MyQueue)"),
        eventBridgeRegion: z
          .string()
          .optional()
          .describe("AWS region for EventBridge destination (e.g. us-east-1)"),
        eventBridgeAccountId: z
          .string()
          .optional()
          .describe("AWS account ID for EventBridge destination"),
      },
    },
    async (args) => notificationsCreateDestinationTool(client, config, args),
  );

  server.registerTool(
    "notifications_list_destinations",
    {
      description:
        "List all Amazon notification destinations configured for this seller. Uses grantless token.",
      inputSchema: {},
    },
    async () => notificationsListDestinationsTool(client),
  );

  server.registerTool(
    "notifications_delete_destination",
    {
      description:
        "Delete an Amazon notification destination by its destinationId. Uses grantless token.",
      inputSchema: {
        destinationId: z.string().describe("The destination ID to delete"),
      },
    },
    async (args) => notificationsDeleteDestinationTool(client, args),
  );

  server.registerTool(
    "notifications_subscribe",
    {
      description:
        "Subscribe to an Amazon notification type and route it to a destination. Seller-authorized (requires refresh token).",
      inputSchema: {
        notificationType: z
          .string()
          .describe("Notification type (e.g. ANY_OFFER_CHANGED, ORDER_CHANGE)"),
        destinationId: z.string().describe("The destination ID to receive the notifications"),
        payloadVersion: z
          .string()
          .optional()
          .describe("Payload version (default: 1.0)"),
      },
    },
    async (args) => notificationsSubscribeTool(client, args),
  );

  server.registerTool(
    "notifications_get_subscription",
    {
      description:
        "Get the current subscription for a notification type. Seller-authorized (requires refresh token).",
      inputSchema: {
        notificationType: z
          .string()
          .describe("Notification type (e.g. ANY_OFFER_CHANGED, ORDER_CHANGE)"),
      },
    },
    async (args) => notificationsGetSubscriptionTool(client, args),
  );

  server.registerTool(
    "notifications_unsubscribe",
    {
      description:
        "Delete a notification subscription by notificationType and subscriptionId. Uses grantless token.",
      inputSchema: {
        notificationType: z
          .string()
          .describe("Notification type the subscription belongs to"),
        subscriptionId: z.string().describe("The subscription ID to delete"),
      },
    },
    async (args) => notificationsUnsubscribeTool(client, args),
  );
}
