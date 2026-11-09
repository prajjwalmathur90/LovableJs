import { TodoItem } from "../lib/plan";

export interface WorkflowAgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

//this message will be passed between activities of the workflow
export interface WorkflowPipelineState {
  todo: TodoItem[];
  thread: WorkflowAgentMessage[];
  files: Record<string, string>;
  design: string;
  builderNotes: string;
  review: string;
  summary: string;
  planMessageId?: string;
}

export function emptyPipeineState(thread: WorkflowAgentMessage[]) {
  return {
    todos: [],
    thread,
    files: {},
    design: "",
    builderNotes: "",
    review: "",
    summary: "",
  };
}
