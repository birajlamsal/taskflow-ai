export type TaskId = string;
export type TaskListId = string;

export interface TaskList {
  id: TaskListId;
  title: string;
  updatedAt?: string;
}

export interface Task {
  id: TaskId;
  listId: TaskListId;
  title: string;
  notes?: string;
  due?: string;
  completed?: boolean;
  updatedAt?: string;
  createdAt?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export type ChatCommandAction =
  | "add_task"
  | "update_task"
  | "reschedule_task"
  | "complete_task"
  | "delete_task"
  | "list_today"
  | "search_tasks"
  | "check_availability_now";

export interface ChatCommand {
  action: ChatCommandAction;
  taskId?: TaskId;
  listId?: TaskListId;
  title?: string;
  notes?: string;
  due?: string;
  completed?: boolean;
  query?: string;
  minutes?: number;
}
