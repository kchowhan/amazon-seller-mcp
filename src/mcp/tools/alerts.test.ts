// src/mcp/tools/alerts.test.ts
import { describe, it, expect } from "vitest";
import { InMemoryEventStore, type NotificationEvent } from "../../notifications/eventStore";
import { recentAlertsTool } from "./alerts";

function makeEvent(mcpUserId: string, type: string, receivedAt: number): NotificationEvent {
  return { mcpUserId, type, payload: { data: "test" }, receivedAt };
}

describe("recentAlertsTool", () => {
  it("returns empty list when store has no events", async () => {
    const store = new InMemoryEventStore();
    const result = await recentAlertsTool(store, "user1", 20);
    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    const text = result.content.at(0)?.text;
    const parsed = JSON.parse(text as string);
    expect(parsed).toEqual([]);
  });

  it("returns events for the mcpUserId", async () => {
    const store = new InMemoryEventStore();
    store.push(makeEvent("user1", "ORDER_CHANGE", 1000));
    store.push(makeEvent("user1", "ANY_OFFER_CHANGED", 2000));
    store.push(makeEvent("user2", "REPORT_PROCESSING_FINISHED", 3000));

    const result = await recentAlertsTool(store, "user1", 20);
    expect(result.isError).toBeFalsy();
    const text = result.content.at(0)?.text;
    const events = JSON.parse(text as string) as NotificationEvent[];
    expect(events).toHaveLength(2);
    // Newest first
    expect(events.at(0)?.type).toBe("ANY_OFFER_CHANGED");
    expect(events.at(1)?.type).toBe("ORDER_CHANGE");
  });

  it("does not return events for a different mcpUserId", async () => {
    const store = new InMemoryEventStore();
    store.push(makeEvent("user2", "ORDER_CHANGE", 1000));

    const result = await recentAlertsTool(store, "user1", 20);
    const text = result.content.at(0)?.text;
    const events = JSON.parse(text as string);
    expect(events).toEqual([]);
  });

  it("respects the limit parameter", async () => {
    const store = new InMemoryEventStore();
    for (let i = 0; i < 10; i++) {
      store.push(makeEvent("user1", "ORDER_CHANGE", i));
    }
    const result = await recentAlertsTool(store, "user1", 3);
    const text = result.content.at(0)?.text;
    const events = JSON.parse(text as string) as NotificationEvent[];
    expect(events).toHaveLength(3);
    // Newest first: receivedAt 9, 8, 7
    expect(events.at(0)?.receivedAt).toBe(9);
  });

  it("returns all fields on event objects", async () => {
    const store = new InMemoryEventStore();
    const ev: NotificationEvent = {
      mcpUserId: "user1",
      type: "ORDER_CHANGE",
      payload: { orderId: "abc-123", status: "Pending" },
      receivedAt: 5000,
    };
    store.push(ev);

    const result = await recentAlertsTool(store, "user1", 20);
    const text = result.content.at(0)?.text;
    const events = JSON.parse(text as string) as NotificationEvent[];
    const first = events.at(0);
    expect(first?.mcpUserId).toBe("user1");
    expect(first?.type).toBe("ORDER_CHANGE");
    expect(first?.receivedAt).toBe(5000);
    expect(first?.payload).toEqual({ orderId: "abc-123", status: "Pending" });
  });
});
