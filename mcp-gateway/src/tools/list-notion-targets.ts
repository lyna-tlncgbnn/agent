import { z } from "zod";
import { listNotionTargets } from "../notion/targets.js";

export const listNotionTargetsSchema = z.object({
  query: z.string().max(100).optional()
});

export type ListNotionTargetsArgs = z.infer<typeof listNotionTargetsSchema>;

export function parseListNotionTargetsArgs(input: unknown): ListNotionTargetsArgs {
  return listNotionTargetsSchema.parse(input ?? {});
}

export async function runListNotionTargets(args: ListNotionTargetsArgs) {
  const result = await listNotionTargets({ query: args.query });

  return {
    text: `已返回 ${result.items.length} 个可选页面`,
    data: result
  };
}
