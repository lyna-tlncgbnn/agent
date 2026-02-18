import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LangChain Notion Assistant",
  description: "M1: Chat and save AI answers to Notion"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
