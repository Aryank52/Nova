import { ShoppingAdapter, ShoppingList, ShoppingItem } from "@nova/shared";
import { db } from "../db.js";
import { randomUUID } from "crypto";

export class SqliteShoppingAdapter implements ShoppingAdapter {
  constructor(private db: any) {}

  async getList(userId: string): Promise<ShoppingList> {
    const listStmt = this.db.prepare("SELECT id, user_id, updated_at FROM shopping_lists WHERE user_id = ?");
    let listRow = listStmt.get(userId) as { id: string; user_id: string; updated_at: string } | undefined;

    if (!listRow) {
      const newId = randomUUID();
      const now = new Date().toISOString();
      this.db.prepare("INSERT INTO shopping_lists (id, user_id, updated_at) VALUES (?, ?, ?)").run(newId, userId, now);
      listRow = { id: newId, user_id: userId, updated_at: now };
    }

    const itemsStmt = this.db.prepare(
      "SELECT id, name, quantity, unit, category, purchased FROM shopping_items WHERE list_id = ? ORDER BY category, name"
    );
    const itemRows = itemsStmt.all(listRow.id) as Array<{
      id: string;
      name: string;
      quantity: number;
      unit: string | null;
      category: string | null;
      purchased: number;
    }>;

    const items: ShoppingItem[] = itemRows.map((row) => ({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit || undefined,
      category: row.category || undefined,
      purchased: Boolean(row.purchased),
    }));

    return {
      id: listRow.id,
      userId: listRow.user_id,
      items,
      updatedAt: new Date(listRow.updated_at),
    };
  }

  async manageList(
    userId: string,
    action: "add" | "remove" | "update",
    items: ShoppingItem[]
  ): Promise<ShoppingList> {
    const list = await this.getList(userId);
    const now = new Date().toISOString();

    switch (action) {
      case "add": {
        const insertItem = this.db.prepare(
          "INSERT INTO shopping_items (id, list_id, name, quantity, unit, category, purchased) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        for (const item of items) {
          insertItem.run(randomUUID(), list.id, item.name, item.quantity, item.unit || null, item.category || null, 0);
        }
        break;
      }
      case "remove": {
        const deleteItem = this.db.prepare("DELETE FROM shopping_items WHERE list_id = ? AND id = ?");
        for (const item of items) {
          deleteItem.run(list.id, item.id);
        }
        break;
      }
      case "update": {
        const updateItem = this.db.prepare(
          "UPDATE shopping_items SET name = ?, quantity = ?, unit = ?, category = ?, purchased = ? WHERE list_id = ? AND id = ?"
        );
        for (const item of items) {
          updateItem.run(item.name, item.quantity, item.unit || null, item.category || null, item.purchased ? 1 : 0, list.id, item.id);
        }
        break;
      }
    }

    this.db.prepare("UPDATE shopping_lists SET updated_at = ? WHERE id = ?").run(now, list.id);
    return this.getList(userId);
  }
}