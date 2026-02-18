import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadGatewayConfig } from "./config/gateway-config.js";
import { AppError, normalizeError } from "./errors/app-error.js";
import { Logger } from "./logging/logger.js";
import { parseListNotionTargetsArgs, runListNotionTargets } from "./tools/list-notion-targets.js";
import { parseGetWeatherArgs, runGetWeather } from "./tools/get-weather.js";
import { parseWebSearchArgs, runWebSearch } from "./tools/web-search.js";
import { parseListLocalFilesArgs, runListLocalFiles } from "./tools/list-local-files.js";
import { parseReadTextFileArgs, runReadTextFile } from "./tools/read-text-file.js";
import { parseExtractPdfTextArgs, runExtractPdfText } from "./tools/extract-pdf-text.js";
import { parseGetLocalAccessPolicyArgs, runGetLocalAccessPolicy } from "./tools/get-local-access-policy.js";
import { parseReadOfficeFileArgs, runReadOfficeFile } from "./tools/read-office-file.js";
import { parseCreateTextFileArgs, runCreateTextFile } from "./tools/create-text-file.js";
import { parseWriteTextFileArgs, runWriteTextFile } from "./tools/write-text-file.js";
import { parseAppendTextFileArgs, runAppendTextFile } from "./tools/append-text-file.js";
import { parseCopyPathArgs, runCopyPath } from "./tools/copy-path.js";
import { parseMovePathArgs, runMovePath } from "./tools/move-path.js";
import { parseRenamePathArgs, runRenamePath } from "./tools/rename-path.js";
import { parseDeletePathArgs, runDeletePath } from "./tools/delete-path.js";
import { parseFindLocalFilesArgs, runFindLocalFiles } from "./tools/find-local-files.js";
import { parseOfficialNotionSearchArgs, runOfficialNotionSearch } from "./tools/official-notion-search.js";
import { parsePingArgs, runPing } from "./tools/ping.js";
import { parseSaveChatAnswerArgs, runSaveChatAnswer } from "./tools/save-chat-answer.js";
import { startHealthServer } from "./transport/health-server.js";

async function main(): Promise<void> {
  const config = await loadGatewayConfig();
  const logger = new Logger(config.logLevel);

  const server = new Server(
    {
      name: config.gatewayName,
      version: config.gatewayVersion
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "ping",
        description: "Gateway health probe tool.",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Optional text that will be echoed back."
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "save_chat_answer",
        description: "将聊天回答保存为 Notion 页面（custom tool）。",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "页面标题，默认 AI 回答" },
            answer: { type: "string", description: "回答正文" },
            sourceType: {
              type: "string",
              enum: ["chat_answer", "bookmark_article"],
              description: "内容来源类型"
            },
            parentPageId: {
              type: "string",
              description: "可选。覆盖默认父页面 ID。"
            }
          },
          required: ["answer"],
          additionalProperties: false
        }
      },
      {
        name: "list_notion_targets",
        description: "返回默认父页面和其子页面列表，支持标题搜索。",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "可选。按页面标题进行模糊搜索。"
            }
          },
          additionalProperties: false
        }
      },
      {
        name: "get_weather",
        description: "按地点查询实时天气（Open-Meteo）。",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "必填。城市或地区名称，例如：北京、上海、San Francisco"
            },
            days: {
              type: "number",
              description: "可选。预报天数，范围 1-3，默认 1。"
            }
          },
          required: ["query"],
          additionalProperties: false
        }
      },
      {
        name: "web_search",
        description: "联网搜索网页信息并返回摘要和来源链接。",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "必填。搜索关键词。"
            },
            max_results: {
              type: "number",
              description: "可选。返回结果条数，范围 1-10，默认 5。"
            }
          },
          required: ["query"],
          additionalProperties: false
        }
      },
      {
        name: "list_local_files",
        description: "列出本地目录文件（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "必填。目录路径，可绝对路径或相对白名单路径。"
            },
            recursive: {
              type: "boolean",
              description: "可选。是否递归列出子目录。"
            },
            max_entries: {
              type: "number",
              description: "可选。最大返回条目数。"
            }
          },
          required: ["path"],
          additionalProperties: false
        }
      },
      {
        name: "read_text_file",
        description: "读取本地文本文件内容（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "必填。文件路径。"
            },
            max_chars: {
              type: "number",
              description: "可选。最大返回字符数。"
            }
          },
          required: ["path"],
          additionalProperties: false
        }
      },
      {
        name: "extract_pdf_text",
        description: "提取本地 PDF 文本（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "必填。PDF 文件路径。"
            },
            max_pages: {
              type: "number",
              description: "可选。最大提取页数。"
            }
          },
          required: ["path"],
          additionalProperties: false
        }
      },
      {
        name: "read_office_file",
        description: "读取本地 Office 文档文本（docx/xlsx/pptx，受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "必填。Office 文件路径。"
            },
            max_chars: {
              type: "number",
              description: "可选。最大返回字符数。"
            }
          },
          required: ["path"],
          additionalProperties: false
        }
      },
      {
        name: "get_local_access_policy",
        description: "读取本地访问白名单与读取限制配置。",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: "create_text_file",
        description: "创建本地文本文件（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "必填。文件路径。" },
            content: { type: "string", description: "可选。初始内容。" },
            overwrite: { type: "boolean", description: "可选。是否覆盖已存在文件。" }
          },
          required: ["path"],
          additionalProperties: false
        }
      },
      {
        name: "write_text_file",
        description: "写入本地文本文件（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "必填。文件路径。" },
            content: { type: "string", description: "必填。写入内容。" },
            overwrite: { type: "boolean", description: "可选。是否覆盖已存在文件。" }
          },
          required: ["path", "content"],
          additionalProperties: false
        }
      },
      {
        name: "append_text_file",
        description: "向本地文本文件追加内容（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "必填。文件路径。" },
            content: { type: "string", description: "必填。追加内容。" }
          },
          required: ["path", "content"],
          additionalProperties: false
        }
      },
      {
        name: "copy_path",
        description: "复制本地文件或目录（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "必填。源路径。" },
            to: { type: "string", description: "必填。目标路径。" },
            overwrite: { type: "boolean", description: "可选。目标存在时是否覆盖。" }
          },
          required: ["from", "to"],
          additionalProperties: false
        }
      },
      {
        name: "move_path",
        description: "移动本地文件或目录（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            from: { type: "string", description: "必填。源路径。" },
            to: { type: "string", description: "必填。目标路径。" },
            overwrite: { type: "boolean", description: "可选。目标存在时是否覆盖。" }
          },
          required: ["from", "to"],
          additionalProperties: false
        }
      },
      {
        name: "rename_path",
        description: "重命名本地文件或目录（受白名单限制）。",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "必填。当前路径。" },
            new_name: { type: "string", description: "必填。新名称（不含路径）。" }
          },
          required: ["path", "new_name"],
          additionalProperties: false
        }
      },
      {
        name: "delete_path",
        description: "删除本地文件或目录（受白名单限制，需 confirm=DELETE）。",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "必填。待删除路径。" },
            recursive: { type: "boolean", description: "可选。删除目录时是否递归。" },
            confirm: { type: "string", description: "必填固定值 DELETE，用于确认危险操作。" }
          },
          required: ["path"],
          additionalProperties: false
        }
      },
      {
        name: "find_local_files",
        description: "在本地白名单目录中按文件名搜索文件/目录。",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "必填。搜索关键词（文件名包含匹配）。" },
            roots: {
              type: "array",
              items: { type: "string" },
              description: "可选。限定搜索根目录（默认全部白名单）。"
            },
            max_entries: { type: "number", description: "可选。最大返回条目数。" },
            include_dirs: { type: "boolean", description: "可选。是否包含目录命中，默认 true。" }
          },
          required: ["query"],
          additionalProperties: false
        }
      },
      {
        name: "official_notion_search",
        description: "官方 MCP 搜索透传（official/custom/hybrid 路由策略）。",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "必填，搜索关键词"
            },
            pageSize: {
              type: "number",
              description: "可选，最多返回条数（1-50）"
            }
          },
          required: ["query"],
          additionalProperties: false
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      if (name === "ping") {
        const parsed = parsePingArgs(args);
        const result = runPing(parsed);

        logger.info("Tool call succeeded", { tool: name });
        return {
          content: [
            {
              type: "text",
              text: result.text
            }
          ],
          structuredContent: result.meta
        };
      }

      if (name === "save_chat_answer") {
        const parsed = parseSaveChatAnswerArgs(args);
        const result = await runSaveChatAnswer(parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          sourceType: parsed.sourceType,
          hasParentOverride: Boolean(parsed.parentPageId)
        });

        return {
          content: [
            {
              type: "text",
              text: result.text
            }
          ],
          structuredContent: result.data
        };
      }

      if (name === "list_notion_targets") {
        const parsed = parseListNotionTargetsArgs(args);
        const result = await runListNotionTargets(parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          query: parsed.query ?? ""
        });

        return {
          content: [
            {
              type: "text",
              text: result.text
            }
          ],
          structuredContent: result.data
        };
      }

      if (name === "get_weather") {
        const parsed = parseGetWeatherArgs(args);
        const result = await runGetWeather(parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          query: parsed.query
        });

        return {
          content: [
            {
              type: "text",
              text: result.text
            }
          ],
          structuredContent: result.data
        };
      }

      if (name === "web_search") {
        const parsed = parseWebSearchArgs(args);
        const result = await runWebSearch(parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          query: parsed.query,
          maxResults: parsed.max_results,
          resultCount: result.data.results.length
        });

        return {
          content: [
            {
              type: "text",
              text: result.text
            }
          ],
          structuredContent: result.data
        };
      }

      if (name === "list_local_files") {
        const parsed = parseListLocalFilesArgs(args);
        const result = await runListLocalFiles(parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          path: parsed.path,
          recursive: parsed.recursive
        });

        return {
          content: [{ type: "text", text: result.text }],
          structuredContent: result.data
        };
      }

      if (name === "read_text_file") {
        const parsed = parseReadTextFileArgs(args);
        const result = await runReadTextFile(parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          path: parsed.path,
          maxChars: parsed.max_chars
        });

        return {
          content: [{ type: "text", text: result.text }],
          structuredContent: result.data
        };
      }

      if (name === "extract_pdf_text") {
        const parsed = parseExtractPdfTextArgs(args);
        const result = await runExtractPdfText(parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          path: parsed.path,
          maxPages: parsed.max_pages
        });

        return {
          content: [{ type: "text", text: result.text }],
          structuredContent: result.data
        };
      }

      if (name === "read_office_file") {
        const parsed = parseReadOfficeFileArgs(args);
        const result = await runReadOfficeFile(parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          path: parsed.path,
          maxChars: parsed.max_chars
        });

        return {
          content: [{ type: "text", text: result.text }],
          structuredContent: result.data
        };
      }

      if (name === "create_text_file") {
        const parsed = parseCreateTextFileArgs(args);
        const result = await runCreateTextFile(parsed);
        logger.info("Tool call succeeded", { tool: name, path: parsed.path, overwrite: parsed.overwrite });
        return { content: [{ type: "text", text: result.text }], structuredContent: result.data };
      }

      if (name === "write_text_file") {
        const parsed = parseWriteTextFileArgs(args);
        const result = await runWriteTextFile(parsed);
        logger.info("Tool call succeeded", { tool: name, path: parsed.path, overwrite: parsed.overwrite });
        return { content: [{ type: "text", text: result.text }], structuredContent: result.data };
      }

      if (name === "append_text_file") {
        const parsed = parseAppendTextFileArgs(args);
        const result = await runAppendTextFile(parsed);
        logger.info("Tool call succeeded", { tool: name, path: parsed.path });
        return { content: [{ type: "text", text: result.text }], structuredContent: result.data };
      }

      if (name === "copy_path") {
        const parsed = parseCopyPathArgs(args);
        const result = await runCopyPath(parsed);
        logger.info("Tool call succeeded", { tool: name, from: parsed.from, to: parsed.to, overwrite: parsed.overwrite });
        return { content: [{ type: "text", text: result.text }], structuredContent: result.data };
      }

      if (name === "move_path") {
        const parsed = parseMovePathArgs(args);
        const result = await runMovePath(parsed);
        logger.info("Tool call succeeded", { tool: name, from: parsed.from, to: parsed.to, overwrite: parsed.overwrite });
        return { content: [{ type: "text", text: result.text }], structuredContent: result.data };
      }

      if (name === "rename_path") {
        const parsed = parseRenamePathArgs(args);
        const result = await runRenamePath(parsed);
        logger.info("Tool call succeeded", { tool: name, path: parsed.path, newName: parsed.new_name });
        return { content: [{ type: "text", text: result.text }], structuredContent: result.data };
      }

      if (name === "delete_path") {
        const parsed = parseDeletePathArgs(args);
        const result = await runDeletePath(parsed);
        logger.info("Tool call succeeded", { tool: name, path: parsed.path, recursive: parsed.recursive });
        return { content: [{ type: "text", text: result.text }], structuredContent: result.data };
      }

      if (name === "find_local_files") {
        const parsed = parseFindLocalFilesArgs(args);
        const result = await runFindLocalFiles(parsed);
        logger.info("Tool call succeeded", {
          tool: name,
          query: parsed.query,
          rootCount: result.data.rootCount,
          count: result.data.count
        });
        return { content: [{ type: "text", text: result.text }], structuredContent: result.data };
      }

      if (name === "get_local_access_policy") {
        parseGetLocalAccessPolicyArgs(args);
        const result = await runGetLocalAccessPolicy();

        logger.info("Tool call succeeded", {
          tool: name,
          allowedRootCount: result.data.allowedRootCount
        });

        return {
          content: [{ type: "text", text: result.text }],
          structuredContent: result.data
        };
      }

      if (name === "official_notion_search") {
        const parsed = parseOfficialNotionSearchArgs(args);
        const result = await runOfficialNotionSearch(config, parsed);

        logger.info("Tool call succeeded", {
          tool: name,
          routeMode: config.notionRouteMode,
          query: parsed.query
        });

        return {
          content: [
            {
              type: "text",
              text: result.text
            }
          ],
          structuredContent: result.data
        };
      }

      throw new AppError("TOOL_NOT_FOUND", `Unknown tool: ${name}`, { tool: name });
    } catch (error) {
      const normalized = normalizeError(error);
      logger.error("Tool call failed", {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details
      });

      return {
        content: [
          {
            type: "text",
            text: `ERROR(${normalized.code}): ${normalized.message}`
          }
        ],
        isError: true
      };
    }
  });

  const healthServer = startHealthServer(config, logger);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Gateway MCP server connected", {
    name: config.gatewayName,
    version: config.gatewayVersion,
    notionRouteMode: config.notionRouteMode
  });

  const shutdown = () => {
    healthServer?.close();
    logger.info("Gateway MCP server shutdown requested");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  const normalized = normalizeError(error);
  const fallbackLogger = new Logger("error");
  fallbackLogger.error("Gateway MCP startup failed", {
    code: normalized.code,
    message: normalized.message,
    details: normalized.details
  });
  process.exit(1);
});
