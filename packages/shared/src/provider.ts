import type { Task, TaskList } from "./types";

export interface TaskProvider {
  getTaskLists(userId: string): Promise<TaskList[]>;
  getTasks(userId: string, listId: string): Promise<Task[]>;
  createTask(userId: string, listId: string, task: Partial<Task>): Promise<Task>;
  updateTask(userId: string, taskId: string, updates: Partial<Task>): Promise<Task>;
  deleteTask(userId: string, taskId: string): Promise<void>;
}

export class GoogleTasksProvider implements TaskProvider {
  async getTaskLists(_userId: string): Promise<TaskList[]> {
    throw new Error("GoogleTasksProvider not configured. Set GOOGLE_CLIENT_ID and tokens.");
  }

  async getTasks(_userId: string, _listId: string): Promise<Task[]> {
    throw new Error("GoogleTasksProvider not configured. Set GOOGLE_CLIENT_ID and tokens.");
  }

  async createTask(_userId: string, _listId: string, _task: Partial<Task>): Promise<Task> {
    throw new Error("GoogleTasksProvider not configured. Set GOOGLE_CLIENT_ID and tokens.");
  }

  async updateTask(_userId: string, _taskId: string, _updates: Partial<Task>): Promise<Task> {
    throw new Error("GoogleTasksProvider not configured. Set GOOGLE_CLIENT_ID and tokens.");
  }

  async deleteTask(_userId: string, _taskId: string): Promise<void> {
    throw new Error("GoogleTasksProvider not configured. Set GOOGLE_CLIENT_ID and tokens.");
  }
}

export class MicrosoftToDoProvider implements TaskProvider {
  async getTaskLists(_userId: string): Promise<TaskList[]> {
    throw new Error("MicrosoftToDoProvider TODO");
  }

  async getTasks(_userId: string, _listId: string): Promise<Task[]> {
    throw new Error("MicrosoftToDoProvider TODO");
  }

  async createTask(_userId: string, _listId: string, _task: Partial<Task>): Promise<Task> {
    throw new Error("MicrosoftToDoProvider TODO");
  }

  async updateTask(_userId: string, _taskId: string, _updates: Partial<Task>): Promise<Task> {
    throw new Error("MicrosoftToDoProvider TODO");
  }

  async deleteTask(_userId: string, _taskId: string): Promise<void> {
    throw new Error("MicrosoftToDoProvider TODO");
  }
}
