// src/notifications/eventStore.test.ts
import { describe, it, expect } from "vitest";
import { InMemoryEventStore, type NotificationEvent } from "./eventStore";

function makeEvent(
  mcpUserId: string,
  type = "ORDER_CHANGE",
  receivedAt = Date.now(),
): NotificationEvent {
  return { mcpUserId, type, payload: { orderId: "123" }, receivedAt };
}

describe("InMemoryEventStore", () => {
  it("returns empty array when no events pushed", () => {
    const store = new InMemoryEventStore();
    expect(store.recent("user1")).toEqual([]);
  });

  it("returns pushed event", () => {
    const store = new InMemoryEventStore();
    const ev = makeEvent("user1");
    store.push(ev);
    const result = store.recent("user1");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(ev);
  });

  it("returns events newest first", () => {
    const store = new InMemoryEventStore();
    const ev1 = makeEvent("user1", "ORDER_CHANGE", 1000);
    const ev2 = makeEvent("user1", "ANY_OFFER_CHANGED", 2000);
    const ev3 = makeEvent("user1", "REPORT_PROCESSING_FINISHED", 3000);
    store.push(ev1);
    store.push(ev2);
    store.push(ev3);
    const result = store.recent("user1");
    expect(result.at(0)?.receivedAt).toBe(3000);
    expect(result.at(1)?.receivedAt).toBe(2000);
    expect(result.at(2)?.receivedAt).toBe(1000);
  });

  it("respects the limit parameter", () => {
    const store = new InMemoryEventStore();
    for (let i = 0; i < 10; i++) {
      store.push(makeEvent("user1", "ORDER_CHANGE", i));
    }
    const result = store.recent("user1", 3);
    expect(result).toHaveLength(3);
    // Should be the 3 newest: receivedAt 9, 8, 7
    expect(result.at(0)?.receivedAt).toBe(9);
    expect(result.at(1)?.receivedAt).toBe(8);
    expect(result.at(2)?.receivedAt).toBe(7);
  });

  it("isolates events per mcpUserId", () => {
    const store = new InMemoryEventStore();
    store.push(makeEvent("user1", "ORDER_CHANGE"));
    store.push(makeEvent("user2", "ANY_OFFER_CHANGED"));
    expect(store.recent("user1")).toHaveLength(1);
    expect(store.recent("user1").at(0)?.type).toBe("ORDER_CHANGE");
    expect(store.recent("user2")).toHaveLength(1);
    expect(store.recent("user2").at(0)?.type).toBe("ANY_OFFER_CHANGED");
    expect(store.recent("user3")).toEqual([]);
  });

  it("evicts oldest events when cap is exceeded", () => {
    const cap = 5;
    const store = new InMemoryEventStore(cap);
    for (let i = 0; i < 8; i++) {
      store.push(makeEvent("user1", "ORDER_CHANGE", i));
    }
    // recent() with large limit returns up to cap
    const result = store.recent("user1", 100);
    expect(result).toHaveLength(cap);
    // Newest (receivedAt 7) should be first; oldest (receivedAt 3) last
    expect(result.at(0)?.receivedAt).toBe(7);
    expect(result.at(-1)?.receivedAt).toBe(3);
  });

  it("per-user cap is independent", () => {
    const store = new InMemoryEventStore(3);
    // Fill user1 to cap
    for (let i = 0; i < 4; i++) store.push(makeEvent("user1", "T", i));
    // user2 unaffected
    store.push(makeEvent("user2", "T", 100));
    // Asserting counts (toHaveLength) is fine; individual index access above uses .at()
    const u1 = store.recent("user1", 100);
    const u2 = store.recent("user2", 100);
    expect(u1).toHaveLength(3);
    expect(u2).toHaveLength(1);
  });
});
