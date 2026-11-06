import { saveResult as saveResultToDb } from "../../repositories/message.repository";
import { FileCollection } from "../../lib/sandbox";

export type SaveResultInput = {
  projectId: string;
  content: string;
  title: string;
  files: FileCollection;
  sandboxUrl: string;
  isError?: boolean;
};

export async function saveResult(input: SaveResultInput) {
  await saveResultToDb(input);
}
