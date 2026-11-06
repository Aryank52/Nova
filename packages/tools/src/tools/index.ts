import { Tool, RiskLevel, ToolSchema } from "@nova/shared";
import { z } from "zod";

export const GetCalendarContextInputSchema = z.object({
  userId: z.string().uuid(),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
});

export const GetCalendarContextOutputSchema = z.object({
  events: z.array(z.object({
    id: z.string(),
    title: z.string(),
    start: z.string().datetime(),
    end: z.string().datetime(),
    location: z.string().optional(),
    attendees: z.array(z.string()).optional(),
  })),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
});

export type GetCalendarContextInput = z.infer<typeof GetCalendarContextInputSchema>;
export type GetCalendarContextOutput = z.infer<typeof GetCalendarContextOutputSchema>;

export const GetWeatherContextInputSchema = z.object({
  location: z.string(),
  date: z.string().datetime().optional(),
});

export const GetWeatherContextOutputSchema = z.object({
  location: z.string(),
  date: z.string().datetime(),
  forecast: z.object({
    temperature: z.object({
      min: z.number(),
      max: z.number(),
      unit: z.enum(["C", "F"]),
    }),
    conditions: z.string(),
    precipitation: z.number(),
    humidity: z.number(),
  }),
});

export type GetWeatherContextInput = z.infer<typeof GetWeatherContextInputSchema>;
export type GetWeatherContextOutput = z.infer<typeof GetWeatherContextOutputSchema>;

export const GetTasksInputSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
});

export const GetTasksOutputSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    userId: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
    priority: z.enum(["low", "medium", "high"]),
    dueDate: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })),
});

export type GetTasksInput = z.infer<typeof GetTasksInputSchema>;
export type GetTasksOutput = z.infer<typeof GetTasksOutputSchema>;

export const UpdateTaskInputSchema = z.object({
  taskId: z.string().uuid(),
  updates: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    dueDate: z.string().datetime().optional(),
  }),
});

export const UpdateTaskOutputSchema = z.object({
  task: z.object({
    id: z.string(),
    userId: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
    priority: z.enum(["low", "medium", "high"]),
    dueDate: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
export type UpdateTaskOutput = z.infer<typeof UpdateTaskOutputSchema>;

export const ManageShoppingListInputSchema = z.object({
  userId: z.string().uuid(),
  action: z.enum(["add", "remove", "update"]),
  items: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    quantity: z.number(),
    unit: z.string().optional(),
    category: z.string().optional(),
    purchased: z.boolean().optional(),
  })),
});

export const ManageShoppingListOutputSchema = z.object({
  list: z.object({
    id: z.string(),
    userId: z.string().uuid(),
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      quantity: z.number(),
      unit: z.string().optional(),
      category: z.string().optional(),
      purchased: z.boolean(),
    })),
    updatedAt: z.string().datetime(),
  }),
});

export type ManageShoppingListInput = z.infer<typeof ManageShoppingListInputSchema>;
export type ManageShoppingListOutput = z.infer<typeof ManageShoppingListOutputSchema>;

export const CreateReminderInputSchema = z.object({
  userId: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  dueDate: z.string().datetime(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
});

export const CreateReminderOutputSchema = z.object({
  reminder: z.object({
    id: z.string(),
    userId: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    dueDate: z.string().datetime(),
    recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
    createdAt: z.string().datetime(),
  }),
});

export type CreateReminderInput = z.infer<typeof CreateReminderInputSchema>;
export type CreateReminderOutput = z.infer<typeof CreateReminderOutputSchema>;

export const GetUserContextInputSchema = z.object({
  userId: z.string().uuid(),
});

export const GetUserContextOutputSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().optional(),
  preferences: z.record(z.unknown()),
  timezone: z.string(),
  location: z.string().optional(),
});

export type GetUserContextInput = z.infer<typeof GetUserContextInputSchema>;
export type GetUserContextOutput = z.infer<typeof GetUserContextOutputSchema>;

export const TOOLS: Tool[] = [
  {
    name: "get_calendar_context",
    description: "Retrieve calendar events for a user within a date range",
    inputSchema: GetCalendarContextInputSchema.shape,
    outputSchema: GetCalendarContextOutputSchema.shape,
    risk: RiskLevel.READ_ONLY,
  },
  {
    name: "get_weather_context",
    description: "Retrieve weather forecast for a location and date",
    inputSchema: GetWeatherContextInputSchema.shape,
    outputSchema: GetWeatherContextOutputSchema.shape,
    risk: RiskLevel.READ_ONLY,
  },
  {
    name: "get_tasks",
    description: "Retrieve tasks for a user, optionally filtered by status",
    inputSchema: GetTasksInputSchema.shape,
    outputSchema: GetTasksOutputSchema.shape,
    risk: RiskLevel.READ_ONLY,
  },
  {
    name: "update_task",
    description: "Update a task's properties (status, priority, due date, etc.)",
    inputSchema: UpdateTaskInputSchema.shape,
    outputSchema: UpdateTaskOutputSchema.shape,
    risk: RiskLevel.LOW_RISK_WRITE,
  },
  {
    name: "manage_shopping_list",
    description: "Add, remove, or update items in a user's shopping list",
    inputSchema: ManageShoppingListInputSchema.shape,
    outputSchema: ManageShoppingListOutputSchema.shape,
    risk: RiskLevel.LOW_RISK_WRITE,
  },
  {
    name: "create_reminder",
    description: "Create a new reminder for a user",
    inputSchema: CreateReminderInputSchema.shape,
    outputSchema: CreateReminderOutputSchema.shape,
    risk: RiskLevel.LOW_RISK_WRITE,
  },
  {
    name: "get_user_context",
    description: "Retrieve user profile and preferences",
    inputSchema: GetUserContextInputSchema.shape,
    outputSchema: GetUserContextOutputSchema.shape,
    risk: RiskLevel.READ_ONLY,
  },
];

export function validateTool(tool: unknown): Tool {
  return ToolSchema.parse(tool);
}

export function getToolByName(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}