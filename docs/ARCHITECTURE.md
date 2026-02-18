# 架构说明（ARCHITECTURE）

## 1. 总体架构

项目分两层：

1. 主应用（Next.js）
- UI、会话管理、SSE 流式输出
- Agent 编排（模型决定是否调用工具）
- 本地 SQLite 持久化

2. MCP 网关（`mcp-gateway`）
- 统一封装工具能力
- 处理联网搜索、Notion、本地文件操作
- 由主应用通过 stdio 子进程按请求拉起

## 2. 聊天执行链路

1. 前端发起 `POST /api/chat`
2. 后端 `lib/llm.ts` 进入 Agent 循环：
- 模型输出 `tool_call` 或 `final`
- 如果是 `tool_call`，调用 MCP 工具并回填结果
- 最终输出 `final`
3. `/api/chat` 通过 SSE 回传：
- 文本增量 `delta`
- 工具进度 `tool_start` / `tool_result`
- 结束 `done`
4. 前端实时渲染，完成后持久化消息到 SQLite

## 3. Tool Calling 策略

- 工具白名单在 `lib/llm.ts` 中定义
- 最大步数：`MAX_TOOL_STEPS = 3`
- 工具失败会回灌给模型，模型可重试或降级回答

## 4. 搜索架构

`web_search` 在网关内统一实现，provider 可配置：
- 免费：DuckDuckGo HTML、Bing RSS
- 付费：SerpAPI（Google/Bing/Baidu）、Tavily

`auto` 模式会按顺序尝试多个 provider，直到命中结果。

## 5. 本地文件安全模型

- 所有本地工具都经过白名单校验
- 白名单由 `LOCAL_FILE_ALLOWED_ROOTS` 控制
- 读取/列举/PDF 页数有上限配置
- 删除操作需要确认参数

## 6. Notion 链路

- 主应用不直连 Notion SDK
- 统一调用网关工具：
  - `save_chat_answer`
  - `list_notion_targets`
  - `official_notion_search`

## 7. 存储

- SQLite（`better-sqlite3`）
- 表：会话 + 消息
- 路径通过 `LOCAL_DB_PATH` 配置

## 8. 设置与配置生效机制

- 设置页写入 `.runtime-config.json`
- 后端读取配置采用“文件 > 环境变量 > 默认值”
- 保存后新请求立即使用新配置
