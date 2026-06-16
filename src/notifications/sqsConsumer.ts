// src/notifications/sqsConsumer.ts
// SQS long-poll consumer for SP-API notifications.
//
// AWS Requirements:
// ─────────────────
// Queue:
//   - Standard SQS queue (SP-API cannot send to FIFO queues).
//   - Queue policy must grant Amazon SP-API the SendMessage permission:
//       Principal: { Service: "mws.amazonservices.com" } (or the regional variant)
//       Action: "SQS:SendMessage"
//   - Recommended: set a message retention period of 4 days and a visibility timeout
//     matching your max processing time (e.g. 30s for most use cases).
//
// IAM (for the role/user running this consumer):
//   - sqs:ReceiveMessage
//   - sqs:DeleteMessage
//   - sqs:GetQueueAttributes
//   on the specific queue ARN.
//
// Environment variables expected:
//   SPAPI_SQS_QUEUE_URL  — e.g. https://sqs.us-east-1.amazonaws.com/123456789012/spapi-notifications
//   AWS_REGION           — e.g. us-east-1
//   (AWS credentials via the standard SDK chain: env / ~/.aws/credentials / EC2 instance role / ECS task role)

import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type Message,
} from "@aws-sdk/client-sqs";
import type { EventStore, NotificationEvent } from "./eventStore.js";

/** Minimal shape of the outer SQS body that SP-API wraps notifications in. */
interface SpApiSqsBody {
  /** The notification type, e.g. "ORDER_CHANGE". */
  NotificationType?: string;
  /** The actual notification payload. Varies by type. */
  Payload?: unknown;
  /** Seller/mcpUserId is derived from the selling partner ID inside the payload.
   *  For our multi-tenant server we require the queue to be per-seller, OR the
   *  message body to include SellerId so we can route to the right EventStore slot.
   *  If absent we fall back to "unknown". */
  SellerId?: string;
}

export interface SqsConsumerOptions {
  /** The SQS queue URL to poll. */
  queueUrl: string;
  /** AWS region, e.g. "us-east-1". */
  region: string;
  /** Max messages per poll (1-10; default 10). */
  maxMessages?: number;
  /** Long-poll wait time in seconds (0-20; default 20). */
  waitTimeSeconds?: number;
  /**
   * Optional: override the mcpUserId for all messages from this queue.
   * Useful when each seller has a dedicated queue (recommended architecture).
   * If not provided, the consumer tries to extract SellerId from the message body.
   */
  mcpUserId?: string;
}

export class SqsConsumer {
  private readonly sqs: SQSClient;
  private running = false;

  constructor(
    private readonly store: EventStore,
    private readonly opts: SqsConsumerOptions,
  ) {
    this.sqs = new SQSClient({ region: opts.region });
  }

  /** Start the polling loop. Returns when stop() is called. */
  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      await this.poll();
    }
  }

  /** Signal the consumer to stop after the current poll completes. */
  stop(): void {
    this.running = false;
  }

  private async poll(): Promise<void> {
    let messages: Message[] = [];
    try {
      const resp = await this.sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: this.opts.queueUrl,
          MaxNumberOfMessages: this.opts.maxMessages ?? 10,
          WaitTimeSeconds: this.opts.waitTimeSeconds ?? 20,
        }),
      );
      messages = resp.Messages ?? [];
    } catch (err) {
      // Log and continue; transient errors should not crash the consumer.
      console.error("[SqsConsumer] Error receiving messages:", err);
      return;
    }

    for (const msg of messages) {
      try {
        await this.handle(msg);
      } catch (err) {
        // Individual message errors are logged but we continue processing others.
        console.error("[SqsConsumer] Error handling message:", err);
      }
    }
  }

  private async handle(msg: Message): Promise<void> {
    if (!msg.Body) return;

    let body: SpApiSqsBody;
    try {
      body = JSON.parse(msg.Body) as SpApiSqsBody;
    } catch {
      console.warn("[SqsConsumer] Skipping non-JSON message:", msg.MessageId);
      await this.deleteMessage(msg);
      return;
    }

    const mcpUserId = this.opts.mcpUserId ?? body.SellerId ?? "unknown";
    const event: NotificationEvent = {
      mcpUserId,
      type: body.NotificationType ?? "UNKNOWN",
      payload: body.Payload ?? body,
      receivedAt: Date.now(),
    };

    this.store.push(event);
    await this.deleteMessage(msg);
  }

  private async deleteMessage(msg: Message): Promise<void> {
    if (!msg.ReceiptHandle) return;
    try {
      await this.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: this.opts.queueUrl,
          ReceiptHandle: msg.ReceiptHandle,
        }),
      );
    } catch (err) {
      console.error("[SqsConsumer] Failed to delete message:", err);
    }
  }
}
