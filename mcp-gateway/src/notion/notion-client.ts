import { Client } from "@notionhq/client";
import { getRequiredGatewayRuntimeValue } from "../config/runtime-config.js";
import { markdownToNotionBlocks } from "./markdown.js";

export type CreateNotionPageInput = {
  title: string;
  markdown: string;
  parentPageId?: string;
};

export async function createNotionPage(input: CreateNotionPageInput) {
  const notionApiKey = await getRequiredGatewayRuntimeValue("NOTION_API_KEY");
  const defaultParentId = await getRequiredGatewayRuntimeValue("NOTION_PARENT_PAGE_ID");

  const notion = new Client({ auth: notionApiKey });
  const parentPageId = input.parentPageId?.trim() || defaultParentId;

  const payload = {
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [
          {
            type: "text",
            text: { content: input.title.slice(0, 100) }
          }
        ]
      }
    },
    children: markdownToNotionBlocks(input.markdown)
  };

  const page = await notion.pages.create(payload as never);
  const pageUrl = "url" in page && typeof page.url === "string"
    ? page.url
    : `https://www.notion.so/${page.id.replace(/-/g, "")}`;

  return {
    id: page.id,
    url: pageUrl,
    parentPageId
  };
}
