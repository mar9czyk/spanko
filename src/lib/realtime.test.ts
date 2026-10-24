import type { RecordSubscription } from "pocketbase";
import { describe, expect, it, vi } from "vitest";
import { type RealtimeCollection, subscribeToCollection } from "./realtime";

/** Atrapa kolekcji: jedno połączenie, wiele nasłuchów, rozłączenie gdy zabraknie nasłuchów. */
function fakeCollection() {
  const listeners = new Set<(event: RecordSubscription<{ id: string }>) => void>();
  const collection: RealtimeCollection<{ id: string }> = {
    async subscribe(_topic, callback) {
      await Promise.resolve();
      listeners.add(callback);
      return async () => {
        listeners.delete(callback);
      };
    },
  };
  const emit = (id: string) => {
    for (const listener of listeners) listener({ action: "update", record: { id } });
  };
  return { collection, listeners, emit };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("subscribeToCollection", () => {
  it("delivers events from the collection", async () => {
    const { collection, emit } = fakeCollection();
    const onEvent = vi.fn();
    subscribeToCollection(collection, onEvent, vi.fn());
    await flush();
    emit("a");
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("StrictMode: a disposed first subscription does not kill the second", async () => {
    const { collection, listeners, emit } = fakeCollection();
    const onEvent = vi.fn();
    const disposeFirst = subscribeToCollection(collection, (event) => onEvent(event), vi.fn());
    disposeFirst(); // cleanup przed zakończeniem subskrypcji
    subscribeToCollection(collection, (event) => onEvent(event), vi.fn());
    await flush();
    expect(listeners.size).toBe(1);
    emit("a");
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("disposing after subscription removes only its own listener", async () => {
    const { collection, listeners } = fakeCollection();
    const other = vi.fn();
    subscribeToCollection(collection, other, vi.fn());
    const dispose = subscribeToCollection(collection, vi.fn(), vi.fn());
    await flush();
    expect(listeners.size).toBe(2);
    dispose();
    await flush();
    expect(listeners.size).toBe(1);
  });

  it("reports subscribe errors", async () => {
    const onError = vi.fn();
    subscribeToCollection(
      {
        subscribe: () => Promise.reject(new Error("sse")),
      },
      vi.fn(),
      onError,
    );
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
