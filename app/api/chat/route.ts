import { z } from "zod";
import { streamChatWithAssistant, type AgentToolProgressEvent } from "@/lib/llm";
import { callSaveChatAnswerTool } from "@/lib/mcp-gateway-client";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1)
      })
    )
    .min(1)
});

type StreamEvent =
  | { type: "delta"; delta: string }
  | { type: "done" }
  | ({ type: "tool_start" } & Extract<AgentToolProgressEvent, { type: "tool_start" }>)
  | ({ type: "tool_result" } & Extract<AgentToolProgressEvent, { type: "tool_result" }>)
  | { type: "notion_saved"; pageUrl: string; title: string }
  | { type: "notion_save_error"; message: string }
  | { type: "error"; message: string };

function toSseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function getLatestUserMessage(messages: Array<{ role: "user" | "assistant"; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item.role === "user") {
      return item.content || "";
    }
  }
  return "";
}

function parseAutoSaveTitle(text: string): string | undefined {
  const patterns = [
    /(?:命名为|命名成|标题为|标题叫|名字叫|名称为)\s*[“"'「『]?\s*([^\n\r,，。？！!?:：”"'`]{1,80})/i,
    /(?:title\s*(?:is|=|:)?\s*)[“"'`]?([^\n\r,，。？！!?:：”"'`]{1,80})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const title = match?.[1]?.trim();
    if (title) {
      return title.replace(/[”"'`」』]+$/g, "").trim();
    }
  }

  return undefined;
}

function shouldAutoSaveToNotion(text: string): boolean {
  const normalized = text.toLowerCase();
  const hasNotion = normalized.includes("notion");
  if (!hasNotion) return false;

  const saveIntent = /(保存|存到|存入|写入|同步|save)/i.test(text);
  if (!saveIntent) return false;

  const negative = /(不要|别|不需要|无需|不用).{0,6}(保存|存|写入).{0,8}notion/i.test(text);
  return !negative;
}

function extractAutoSaveInstruction(messages: Array<{ role: "user" | "assistant"; content: string }>): {
  shouldSave: boolean;
  title?: string;
} {
  const latestUserText = getLatestUserMessage(messages);
  if (!latestUserText || !shouldAutoSaveToNotion(latestUserText)) {
    return { shouldSave: false };
  }

  return {
    shouldSave: true,
    title: parseAutoSaveTitle(latestUserText)
  };
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        toSseEvent({ type: "error", message: "请求参数不合法" }),
        {
          status: 400,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive"
          }
        }
      );
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const autoSaveInstruction = extractAutoSaveInstruction(parsed.data.messages);
          let fullAnswer = "";

          for await (const delta of streamChatWithAssistant(parsed.data.messages, {
            onToolProgress: (event) => {
              controller.enqueue(encoder.encode(toSseEvent(event)));
            }
          })) {
            fullAnswer += delta;
            controller.enqueue(encoder.encode(toSseEvent({ type: "delta", delta })));
          }

          if (autoSaveInstruction.shouldSave && fullAnswer.trim().length > 0) {
            try {
              const saveResult = await callSaveChatAnswerTool({
                title: autoSaveInstruction.title,
                answer: fullAnswer.trim(),
                sourceType: "chat_answer"
              });

              controller.enqueue(
                encoder.encode(
                  toSseEvent({
                    type: "notion_saved",
                    pageUrl: saveResult.pageUrl,
                    title: autoSaveInstruction.title || "AI 回答"
                  })
                )
              );
            } catch (saveError) {
              controller.enqueue(
                encoder.encode(
                  toSseEvent({
                    type: "notion_save_error",
                    message: saveError instanceof Error ? saveError.message : "自动保存失败"
                  })
                )
              );
            }
          }

          controller.enqueue(encoder.encode(toSseEvent({ type: "done" })));
        } catch (error) {
          const message = error instanceof Error ? error.message : "聊天接口异常";
          controller.enqueue(encoder.encode(toSseEvent({ type: "error", message })));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "聊天接口异常";
    return new Response(toSseEvent({ type: "error", message }), {
      status: 500,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  }
}
