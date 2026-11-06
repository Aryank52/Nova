import { CalendarAdapter, CalendarContext, CalendarEvent } from "@nova/shared";
import { db } from "../db.js";

export class SqliteCalendarAdapter implements CalendarAdapter {
  constructor(private db: any) {}

  async getContext(userId: string, dateRange?: { start: Date; end: Date }): Promise<CalendarContext> {
    const start = dateRange?.start || new Date();
    start.setHours(0, 0, 0, 0);
    const end = dateRange?.end || new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);

    const stmt = this.db.prepare(`
      SELECT id, title, start_time, end_time, location, attendees
      FROM calendar_events
      WHERE user_id = ? AND start_time >= ? AND start_time <= ?
      ORDER BY start_time ASC
    `);

    const rows = stmt.all(userId, start.toISOString(), end.toISOString()) as Array<{
      id: string;
      title: string;
      start_time: string;
      end_time: string;
      location: string | null;
      attendees: string | null;
    }>;

    const events: CalendarEvent[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      start: new Date(row.start_time),
      end: new Date(row.end_time),
      location: row.location || undefined,
      attendees: row.attendees ? JSON.parse(row.attendees) : undefined,
    }));

    return {
      events,
      dateRange: { start, end },
    };
  }
}