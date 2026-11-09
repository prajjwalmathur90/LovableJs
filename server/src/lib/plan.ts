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
