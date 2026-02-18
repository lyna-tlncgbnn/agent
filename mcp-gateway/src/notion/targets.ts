import { Client } from "@notionhq/client";
import { AppError } from "../errors/app-error.js";
import { getRequiredGatewayRuntimeValue } from "../config/runtime-config.js";

export type NotionTargetOption = {
  id: string;
  title: string;
  type: "default_parent" | "child_page";
  isDefault: boolean;
};

export type ListNotionTargetsInput = {
  query?: string;
};

function normalizeTitle(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Untitled";
}

function extractTitleFromPage(page: Record<string, unknown>): string {
  const properties = page.properties;
  if (!properties || typeof properties !== "object") {
    return "Untitled";
  }

  for (const value of Object.values(properties as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;

    const typed = value as { type?: unknown; title?: unknown };
    if (typed.type !== "title" || !Array.isArray(typed.title)) continue;

    const plain = typed.title
      .map((item) => {
        if (typeof item === "object" && item !== null && "plain_text" in item) {
          const text = (item as { plain_text?: unknown }).plain_text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("")
      .trim();

    if (plain) return plain;
  }

  return "Untitled";
}

function matchesQuery(title: string, query?: string): boolean {
  if (!query) return true;
  return title.toLowerCase().includes(query.toLowerCase());
}

export async function listNotionTargets(input: ListNotionTargetsInput): Promise<{
  defaultParent: NotionTargetOption;
  items: NotionTargetOption[];
}> {
  const notionApiKey = await getRequiredGatewayRuntimeValue("NOTION_API_KEY");
  const defaultParentId = await getRequiredGatewayRuntimeValue("NOTION_PARENT_PAGE_ID");

  if (!notionApiKey) {
    throw new AppError("CONFIG_MISSING", "缺少配置: NOTION_API_KEY");
  }

  if (!defaultParentId) {
    throw new AppError("CONFIG_MISSING", "缺少配置: NOTION_PARENT_PAGE_ID");
  }

  const notion = new Client({ auth: notionApiKey });

  const defaultParentPage = await notion.pages.retrieve({ page_id: defaultParentId } as never);
  const defaultParentTitle = extractTitleFromPage(defaultParentPage as unknown as Record<string, unknown>);

  const children = await notion.blocks.children.list({
    block_id: defaultParentId,
    page_size: 100
  } as never);

  const defaultParent: NotionTargetOption = {
    id: defaultParentId,
    title: normalizeTitle(defaultParentTitle),
    type: "default_parent",
    isDefault: true
  };

  const childOptions = children.results
    .map((item): NotionTargetOption | null => {
      if (!item || typeof item !== "object") return null;
      const block = item as Record<string, unknown>;
      if (block.type !== "child_page") return null;
      if (typeof block.id !== "string") return null;

      const childPage = block.child_page as { title?: unknown } | undefined;
      const title = typeof childPage?.title === "string" ? childPage.title : "Untitled";

      return {
        id: block.id,
        title: normalizeTitle(title),
        type: "child_page",
        isDefault: false
      };
    })
    .filter((item): item is NotionTargetOption => item !== null);

  const query = input.query?.trim();
  const filteredDefault = matchesQuery(defaultParent.title, query) ? [defaultParent] : [];
  const filteredChildren = childOptions.filter((item) => matchesQuery(item.title, query));

  return {
    defaultParent,
    items: [...filteredDefault, ...filteredChildren]
  };
}
