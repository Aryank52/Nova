import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { memoryStore } from "../index.js";
import { MemoryCategory, randomUUID } from "@nova/shared";

describe("MemoryStore", () => {
  const userId = `test-user-${randomUUID()}`;

  afterEach(async () => {
    // Clean up test data
    const records = await memoryStore.getByUserAndCategory(userId, "preferences");
    for (const record of records) {
      await memoryStore.delete(record.id);
    }
  });

  it("should store and retrieve a memory record", async () => {
    const record = await memoryStore.set({
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

    const retrieved = await memoryStore.get(record.id);
    expect(retrieved).toEqual(record);
  });

  it("should update existing memory record", async () => {
    const record = await memoryStore.set({
      userId,
      category: "preferences",
      key: "theme",
      value: { theme: "light" },
      expiresAt: null,
    });

    const updated = await memoryStore.set({
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
    await memoryStore.set({ userId, category: "preferences", key: "theme", value: { theme: "dark" }, expiresAt: null });
    await memoryStore.set({ userId, category: "preferences", key: "language", value: { lang: "en" }, expiresAt: null });
    await memoryStore.set({ userId, category: "routines", key: "morning", value: { time: "7:00" }, expiresAt: null });

    const prefs = await memoryStore.getByUserAndCategory(userId, "preferences");
    expect(prefs).toHaveLength(2);

    const routines = await memoryStore.getByUserAndCategory(userId, "routines");
    expect(routines).toHaveLength(1);
  });

  it("should get memory by user and key", async () => {
    await memoryStore.set({ userId, category: "preferences", key: "theme", value: { theme: "dark" }, expiresAt: null });

    const record = await memoryStore.getByUserAndKey(userId, "preferences", "theme");
    expect(record).not.toBeNull();
    expect(record?.value).toEqual({ theme: "dark" });

    const notFound = await memoryStore.getByUserAndKey(userId, "preferences", "nonexistent");
    expect(notFound).toBeNull();
  });

  it("should delete memory record", async () => {
    const record = await memoryStore.set({ userId, category: "preferences", key: "theme", value: { theme: "dark" }, expiresAt: null });
    await memoryStore.delete(record.id);

    const retrieved = await memoryStore.get(record.id);
    expect(retrieved).toBeNull();
  });

  it("should find relevant memories", async () => {
    await memoryStore.set({ userId, category: "preferences", key: "theme", value: { theme: "dark" }, expiresAt: null });
    await memoryStore.set({ userId, category: "routines", key: "morning", value: { activity: "coffee" }, expiresAt: null });
    await memoryStore.set({ userId, category: "commitments", key: "meeting", value: { with: "team" }, expiresAt: null });

    const relevant = await memoryStore.getRelevant(userId, "theme");
    expect(relevant.length).toBeGreaterThan(0);
    expect(relevant.some((r) => r.key === "theme")).toBe(true);
  });
});