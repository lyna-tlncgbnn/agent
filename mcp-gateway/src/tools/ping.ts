import { z } from "zod";

const pingArgsSchema = z.object({
  message: z.string().min(1).max(300).optional()
});

export type PingArgs = z.infer<typeof pingArgsSchema>;

export function parsePingArgs(input: unknown): PingArgs {
  return pingArgsSchema.parse(input ?? {});
}

export function runPing(args: PingArgs): { text: string; meta: Record<string, unknown> } {
  const msg = args.message?.trim() || "pong";
  return {
    text: `pong: ${msg}`,
    meta: {
      echoed: msg,
      timestamp: new Date().toISOString()
    }
  };
}
