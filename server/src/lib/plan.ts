export type ToDoStatus = "pending" | "in_progress" | "done";

export interface TodoItem {
  content: string;
  status: ToDoStatus;
}

export const PLAN_KIND = "plan";

export interface PlanActivity {
  agent: string;
  details: string;
}

export interface PlanMessage {
  todo: TodoItem[];
  kind: typeof PLAN_KIND;
  activity?: PlanActivity;
}

export const STATUSES: ToDoStatus[] = ["pending", "in_progress", "done"];

export function normalizeToDo(value: unknown): TodoItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.content !== "string") {
    return null;
  }

  const content = record.content.trim();
  if (!content) {
    return null;
  }

  let status: ToDoStatus = "pending";
  if (typeof record.status === "string") {
    const rawStatus = record.status.trim().toLowerCase();
    if (STATUSES.includes(rawStatus as ToDoStatus)) {
      status = rawStatus as ToDoStatus;
    }
  }

  return {
    content,
    status,
  };
}

export const normalizeTodo = normalizeToDo;

export function parseToDos(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeToDo(item))
    .filter((item): item is TodoItem => item !== null);
}

export const parseTodos = parseToDos;

export function formatPlanForAgent(todos: TodoItem[]): string {
  if (!todos || todos.length === 0) {
    return "";
  }

  const lines = todos.map(
    (todo, index) => `${index + 1}. [${todo.status}] ${todo.content}`,
  );

  return `Current plan:\n${lines.join("\n")}\n\nFollow this plan in order, update it with write_todos as you complete steps.`;
}

export function parsePlanMessage(content: string): TodoItem[] | null {
  try {
    const parsed: Partial<PlanMessage> = JSON.parse(content);

    if (!parsed || parsed.kind !== PLAN_KIND) {
      return null;
    }

    const todos = parseToDos(
      parsed.todo ?? (parsed as Record<string, unknown>).todos,
    );

    return todos.length > 0 ? todos : null;
  } catch {
    return null;
  }
}
