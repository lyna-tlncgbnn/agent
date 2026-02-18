// 将 Markdown 转换为 Notion blocks。
// 这里只实现了本项目当前需要的常用语法，便于后续按需扩展。
export function answerToMarkdown(title: string, answer: string, sourceType: string): string {
  const safeTitle = title.trim() || "AI 回答";
  const safeAnswer = answer.trim();
  const now = new Date().toISOString();

  return [
    `# ${safeTitle}`,
    "",
    "## 内容",
    safeAnswer,
    "",
    "## 元信息",
    `- Source Type: ${sourceType}`,
    `- Saved At: ${now}`
  ].join("\n");
}

function chunkText(text: string, size = 1800): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

function richText(content: string) {
  return chunkText(content).map((chunk) => ({
    type: "text" as const,
    text: { content: chunk }
  }));
}

export function markdownToNotionBlocks(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const blocks: unknown[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("### ")) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: richText(line.slice(4)) } });
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: richText(line.slice(3)) } });
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: richText(line.slice(2)) } });
      continue;
    }

    if (line.startsWith("- ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: richText(line.slice(2)) }
      });
      continue;
    }

    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: richText(line) } });
  }

  return blocks.slice(0, 90);
}
