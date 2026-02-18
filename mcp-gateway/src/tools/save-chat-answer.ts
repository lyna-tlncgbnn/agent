import { z } from "zod";
import { answerToMarkdown } from "../notion/markdown.js";
import { createNotionPage } from "../notion/notion-client.js";

const sourceTypeSchema = z.enum(["chat_answer", "bookmark_article"]);

export const saveChatAnswerSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  answer: z.string().min(1),
  sourceType: sourceTypeSchema.default("chat_answer"),
  parentPageId: z.string().min(1).optional()
});

export type SaveChatAnswerArgs = z.infer<typeof saveChatAnswerSchema>;

export function parseSaveChatAnswerArgs(input: unknown): SaveChatAnswerArgs {
  return saveChatAnswerSchema.parse(input ?? {});
}

export async function runSaveChatAnswer(args: SaveChatAnswerArgs) {
  const title = args.title?.trim() || "AI 回答";
  const markdown = answerToMarkdown(title, args.answer, args.sourceType);

  // 统一通过 gateway 内部 Notion client 写入，后续可在这里增加审计/策略层。
  const page = await createNotionPage({
    title,
    markdown,
    parentPageId: args.parentPageId
  });

  return {
    text: `保存成功: ${page.url}`,
    data: {
      pageId: page.id,
      pageUrl: page.url,
      parentPageId: page.parentPageId,
      markdown,
      sourceType: args.sourceType
    }
  };
}
