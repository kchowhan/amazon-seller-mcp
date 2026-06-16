// src/notifications/eventStore.ts
// In-memory event store for SP-API notification events delivered via SQS.

/** A single SP-API notification event received from SQS. */
export interface NotificationEvent {
  /** The MCP user (seller) this notification belongs to. */
  mcpUserId: string;
  /** SP-API notification type (e.g. "ORDER_CHANGE", "ANY_OFFER_CHANGED"). */
  type: string;
  /** The raw parsed notification payload from SQS. */
  payload: unknown;
  /** Unix timestamp (ms) when the event was received by the consumer. */
  receivedAt: number;
}

/** Interface for storing and retrieving notification events. */
export interface EventStore {
  /** Push a new event into the store. */
  push(event: NotificationEvent): void;
  /**
   * Return recent events for the given mcpUserId, newest first.
   * @param mcpUserId The MCP user whose events to return.
   * @param limit Max number of events to return (default: 20).
   */
  recent(mcpUserId: string, limit?: number): NotificationEvent[];
}

/**
 * In-memory ring buffer implementation of EventStore.
 * Stores up to `cap` events per mcpUserId; oldest are evicted when the cap is reached.
 */
export class InMemoryEventStore implements EventStore {
  private readonly buffers = new Map<string, NotificationEvent[]>();

  /**
   * @param cap Max events stored per mcpUserId. Default 200.
   */
  constructor(private readonly cap: number = 200) {}

  push(event: NotificationEvent): void {
    let buf = this.buffers.get(event.mcpUserId);
    if (!buf) {
      buf = [];
      this.buffers.set(event.mcpUserId, buf);
    }
    buf.push(event);
    // Evict oldest entries once the cap is exceeded.
    if (buf.length > this.cap) {
      buf.splice(0, buf.length - this.cap);
    }
  }

  recent(mcpUserId: string, limit = 20): NotificationEvent[] {
    const buf = this.buffers.get(mcpUserId);
    if (!buf || buf.length === 0) return [];
    // Return newest first, up to limit.
    return buf.slice(-limit).reverse();
  }
}
