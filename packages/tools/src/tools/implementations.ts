import { ToolCall, ToolResult, RiskLevel } from "@nova/shared";
import { db } from "../db.js";
import { SqliteCalendarAdapter } from "../adapters/calendar.js";
import { SqliteWeatherAdapter } from "../adapters/weather.js";
import { SqliteTaskAdapter } from "../adapters/task.js";
import { SqliteShoppingAdapter } from "../adapters/shopping.js";
import { SqliteReminderAdapter } from "../adapters/reminder.js";
import { SqliteUserContextAdapter } from "../adapters/user-context.js";
import {
  GetCalendarContextInputSchema,
  GetCalendarContextOutputSchema,
  GetWeatherContextInputSchema,
  GetWeatherContextOutputSchema,
  GetTasksInputSchema,
  GetTasksOutputSchema,
  UpdateTaskInputSchema,
  UpdateTaskOutputSchema,
  ManageShoppingListInputSchema,
  ManageShoppingListOutputSchema,
  CreateReminderInputSchema,
  CreateReminderOutputSchema,
  GetUserContextInputSchema,
  GetUserContextOutputSchema,
} from "./index.js";

const calendarAdapter = new SqliteCalendarAdapter(db);
const weatherAdapter = new SqliteWeatherAdapter(db);
const taskAdapter = new SqliteTaskAdapter(db);
const shoppingAdapter = new SqliteShoppingAdapter(db);
const reminderAdapter = new SqliteReminderAdapter(db);
const userContextAdapter = new SqliteUserContextAdapter(db);

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const timestamp = Date.now();

  try {
    let data: unknown;

    switch (call.tool) {
      case "get_calendar_context": {
        const input = GetCalendarContextInputSchema.parse(call.arguments);
        const context = await calendarAdapter.getContext(input.userId, input.dateRange
          ? { start: new Date(input.dateRange.start), end: new Date(input.dateRange.end) }
          : undefined);
        data = GetCalendarContextOutputSchema.parse({
          events: context.events.map((e: { id: string; title: string; start: Date; end: Date; location?: string; attendees?: string[] }) => ({
            id: e.id,
            title: e.title,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
            location: e.location,
            attendees: e.attendees,
          })),
          dateRange: {
            start: context.dateRange.start.toISOString(),
            end: context.dateRange.end.toISOString(),
          },
        });
        break;
      }

      case "get_weather_context": {
        const input = GetWeatherContextInputSchema.parse(call.arguments);
        const context = await weatherAdapter.getContext(input.location, input.date ? new Date(input.date) : undefined);
        data = GetWeatherContextOutputSchema.parse({
          location: context.location,
          date: context.date.toISOString(),
          forecast: context.forecast,
        });
        break;
      }

      case "get_tasks": {
        const input = GetTasksInputSchema.parse(call.arguments);
        const tasks = await taskAdapter.getTasks(input.userId, input.status);
        data = GetTasksOutputSchema.parse({
          tasks: tasks.map((t: { id: string; userId: string; title: string; description?: string; status: string; priority: string; dueDate?: Date; createdAt: Date; updatedAt: Date }) => ({
            id: t.id,
            userId: t.userId,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate?.toISOString(),
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          })),
        });
        break;
      }

      case "update_task": {
        const input = UpdateTaskInputSchema.parse(call.arguments);
        const updates: Record<string, unknown> = {};
        if (input.updates.title !== undefined) updates.title = input.updates.title;
        if (input.updates.description !== undefined) updates.description = input.updates.description;
        if (input.updates.status !== undefined) updates.status = input.updates.status;
        if (input.updates.priority !== undefined) updates.priority = input.updates.priority;
        if (input.updates.dueDate !== undefined) updates.dueDate = new Date(input.updates.dueDate);

        const task = await taskAdapter.updateTask(input.taskId, updates as any);
        data = UpdateTaskOutputSchema.parse({
          task: {
            id: task.id,
            userId: task.userId,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate?.toISOString(),
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
          },
        });
        break;
      }

      case "manage_shopping_list": {
        const input = ManageShoppingListInputSchema.parse(call.arguments);
        const list = await shoppingAdapter.manageList(input.userId, input.action, input.items as any);
        data = ManageShoppingListOutputSchema.parse({
          list: {
            id: list.id,
            userId: list.userId,
            items: list.items.map((item: { id: string; name: string; quantity: number; unit?: string; category?: string; purchased: boolean }) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category: item.category,
              purchased: item.purchased,
            })),
            updatedAt: list.updatedAt.toISOString(),
          },
        });
        break;
      }

      case "create_reminder": {
        const input = CreateReminderInputSchema.parse(call.arguments);
        const reminder = await reminderAdapter.createReminder(input.userId, {
          title: input.title,
          description: input.description,
          dueDate: new Date(input.dueDate),
          recurrence: input.recurrence,
        });
        data = CreateReminderOutputSchema.parse({
          reminder: {
            id: reminder.id,
            userId: reminder.userId,
            title: reminder.title,
            description: reminder.description,
            dueDate: reminder.dueDate.toISOString(),
            recurrence: reminder.recurrence,
            createdAt: reminder.createdAt.toISOString(),
          },
        });
        break;
      }

      case "get_user_context": {
        const input = GetUserContextInputSchema.parse(call.arguments);
        const context = await userContextAdapter.getContext(input.userId);
        data = GetUserContextOutputSchema.parse(context);
        break;
      }

      default:
        throw new Error(`Unknown tool: ${call.tool}`);
    }

    return {
      callId: call.id,
      success: true,
      data,
      error: null,
      timestamp,
    };
  } catch (error) {
    return {
      callId: call.id,
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp,
    };
  }
}