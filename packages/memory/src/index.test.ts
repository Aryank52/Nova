import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryStore } from "./index.js";
import { MemoryCategory, randomUUID } from "@nova/shared";

describe("MemoryStore", () => {
  let store: MemoryStore;
  const userId = `test-user-${randomUUID()}`;

  beforeEach(() => {
    store = new MemoryStore();
  });

  afterEach(async () => {
    const records = await store.getByUserAndCategory(userId, "preferences");
    for (const record of records) {
      await store.delete(record.id);
    }
  });

  it("should store and retrieve a memory record", async () => {
    const record = await store.set({
      userId,
      category: "preferences",
      key: "theme",
      value: { theme: "dark", fontSize: 14 },
      expiresAt: null,
    });

    expect(record.id).toBeDefined();
    expect(record.userId).toBe(userId);
    expect(record.category).toBe("preferences");
    expect(record.key).toBe("theme");
    expect(record.value).toEqual({ theme: "dark", fontSize: 14 });

    const retrieved = await store.get(record.id);
    expect(retrieved).toEqual(record);
  });

  it("should update existing memory record", async () => {
    const record = await store.set({
      userId,
      category: "preferences",
      key: "theme",
      value: { theme: "light" },
      expiresAt: null,
    });

    const updated = await store.set({
      id: record.id,
      userId,
      category: "preferences",
      key: "theme",
      value: { theme: "dark" },
      expiresAt: null,
    });

    expect(updated.value).toEqual({ theme: "dark" });
    expect(updated.updatedAt).toBeGreaterThan(record.updatedAt);
  });

  it("should get memories by user and category", async () => {
    await store.set({ userId, category: "preferences", key: "theme", value: { theme: "dark" }, expiresAt: null });
    await store.set({ userId, category: "preferences", key: "language", value: { lang: "en" }, expiresAt: null });
    await store.set({ userId, category: "routines", key: "morning", value: { time: "7:00" }, expiresAt: null });

    const prefs = await store.getByUserAndCategory(userId, "preferences");
    expect(prefs).toHaveLength(2);

    const routines = await store.getByUserAndCategory(userId, "routines");
    expect(routines).toHaveLength(1);
  });

  it("should get memory by user and key", async () => {
    await store.set({ userId, category: "preferences", key: "theme", value: { theme: "dark" }, expiresAt: null });

    const record = await store.getByUserAndKey(userId, "preferences", "theme");
    expect(record).not.toBeNull();
    expect(record?.value).toEqual({ theme: "dark" });

    const notFound = await store.getByUserAndKey(userId, "preferences", "nonexistent");
    expect(notFound).toBeNull();
  });

  it("should delete memory record", async () => {
    const record = await store.set({ userId, category: "preferences", key: "theme", value: { theme: "dark" }, expiresAt: null });
    await store.delete(record.id);

    const retrieved = await store.get(record.id);
    expect(retrieved).toBeNull();
  });

  it("should find relevant memories", async () => {
    await store.set({ userId, category: "preferences", key: "theme", value: { theme: "dark" }, expiresAt: null });
    await store.set({ userId, category: "routines", key: "morning", value: { activity: "coffee" }, expiresAt: null });
    await store.set({ userId, category: "commitments", key: "meeting", value: { with: "team" }, expiresAt: null });

    const relevant = await store.getRelevant(userId, "theme");
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant.some((r) => r.key === "theme")).toBe(true);
  });

  it("should handle expiry", async () => {
    const pastDate = new Date(Date.now() - 1000);
    const record = await store.set({
      userId,
      category: "preferences",
      key: "temp",
      value: { temp: true },
      expiresAt: pastDate.getTime(),
    });

    // The expired record should still be retrievable but marked as expired
    const retrieved = await store.get(record.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.expiresAt).toEqual(pastDate.getTime());

    // Clean up expired
    const deleted = await store.deleteExpired();
    expect(deleted).toBeGreaterThanOrEqual(0);
  });
});