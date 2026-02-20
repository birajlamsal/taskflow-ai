import { z } from "zod";

export const taskListSchema = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.string().optional()
});

export const taskSchema = z.object({
  id: z.string(),
  listId: z.string(),
  title: z.string(),
  notes: z.string().optional(),
  due: z.string().optional(),
  completed: z.boolean().optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional()
});

export const chatCommandSchema = z.object({
  action: z.enum([
    "add_task",
    "update_task",
    "reschedule_task",
    "complete_task",
    "delete_task",
    "list_today",
    "search_tasks",
    "check_availability_now"
  ]),
  taskId: z.string().optional(),
  listId: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  due: z.string().optional(),
  completed: z.boolean().optional(),
  query: z.string().optional(),
  minutes: z.number().int().positive().optional()
});

export type ChatCommandSchema = z.infer<typeof chatCommandSchema>;
