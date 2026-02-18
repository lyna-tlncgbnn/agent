"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type ChatMarkdownProps = {
  content: string;
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize];

function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
      {content}
    </ReactMarkdown>
  );
}

export default memo(ChatMarkdown);
