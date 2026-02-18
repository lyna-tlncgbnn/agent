# LangChain Notion Assistant

一个基于 `LangChain JS/TS + Next.js + MCP` 的个人知识助手。

当前你可以完成三件事：
1. GPT 风格多会话聊天（流式输出 + Markdown/GFM 渲染）
2. 把 AI 回答一键保存到 Notion
3. 在设置页动态修改模型、Notion、MCP、本地存储配置（无需重启）
4. 在提问中显式要求“保存到 Notion”时，回答完成后自动保存（支持“命名为 xxx”）

## 当前状态（2026-02-14）

1. `M1`：已完成
2. `M2`：进行中
3. `M2` 内已完成：
- Notion 保存目标页面选择（默认父页面 + 子页面搜索）
- 本地 SQLite 存储
- 多会话（新建会话 / 历史会话切换）
- 设置页新增“数据存储”标签（路径配置、统计、清空）
4. `M2` 内未完成：
- Edge 收藏自动抓取与自动入库

## 技术栈

### 主项目
1. Next.js 15（App Router）
2. React 19 + TypeScript
3. LangChain JS
4. `better-sqlite3`
5. `react-markdown + remark-gfm`

### MCP 子项目（`mcp-gateway`）
1. `@modelcontextprotocol/sdk`
2. 自定义 Notion 工具：`save_chat_answer`、`list_notion_targets`
3. 官方能力透传：`official_notion_search`

## 项目结构

```text
F:\langchain-notion-assistant
  app/                         # 页面与 API 路由
  lib/                         # 核心逻辑（LLM、MCP client、SQLite）
  mcp-gateway/                 # MCP 子项目
  PROJECT_PLAN.md              # 业务路线与进度
  MCP_GATEWAY_PLAN.md          # MCP 路线与进度
```

## 快速开始

### 1. 安装依赖

```bash
cd F:\langchain-notion-assistant
npm install

cd F:\langchain-notion-assistant\mcp-gateway
npm install
npm run build
```

### 2. 启动

```bash
cd F:\langchain-notion-assistant
npm run dev
```

访问：
1. `http://localhost:3100`（聊天页）
2. `http://localhost:3100/settings`（设置页）

## 配置说明

在 `http://localhost:3100/settings` 保存：

1. `OPENAI_API_KEY`
2. `OPENAI_BASE_URL`
3. `OPENAI_MODEL`
4. `NOTION_API_KEY`
5. `NOTION_PARENT_PAGE_ID`
6. `LOCAL_DB_PATH`（SQLite 文件路径）

配置会写入根目录 `.runtime-config.json`，立即生效。

## MCP 运行方式（当前实现）

主项目调用 Notion 时通过 `lib/mcp-gateway-client.ts` 使用 **stdio 子进程按请求拉起网关**：
1. 不要求你单独常驻 `mcp-gateway` 进程
2. 但要求 `mcp-gateway/dist/server.js` 已构建完成（即先执行过 `mcp-gateway` 的 `npm run build`）

## 本地数据存储

### 存储引擎
- SQLite（`better-sqlite3`）

### 默认路径
- `F:\langchain-notion-assistant\data\assistant.db`（可在设置页修改）

### 数据表
1. `chat_sessions`
2. `chat_messages`

### 说明
1. 历史 localStorage 聊天方案已废弃（按新需求不迁移旧数据）
2. 聊天会话由 SQLite 持久化管理

## 主项目 API

1. `POST /api/chat`：流式聊天
2. `GET /api/settings`：读取配置
3. `POST /api/settings`：保存配置
4. `GET /api/sessions`：会话列表
5. `POST /api/sessions`：新建会话
6. `GET /api/sessions/[id]/messages`：读取会话消息
7. `POST /api/sessions/[id]/messages`：写入消息
8. `DELETE /api/sessions/[id]`：删除会话
9. `GET /api/storage`：读取存储统计
10. `POST /api/storage/clear`：清空本地会话
11. `POST /api/notion/save`：保存回答到 Notion（经 MCP）
12. `GET /api/notion/parents`：读取 Notion 目标页面（经 MCP）

## 常见问题

### 1. 保存到 Notion 失败
1. `NOTION_API_KEY` 未配置或无权限
2. `NOTION_PARENT_PAGE_ID` 错误
3. 父页面未共享给 Integration

### 2. Build 遇到 Windows `.next/trace` EPERM
清理 `.next` 并结束残留 node 进程后重试构建。

## 相关文档

1. `PROJECT_PLAN.md`
2. `MCP_GATEWAY_PLAN.md`
3. `NOTION_AUTO_SAVE_GUIDE.md`
4. `M5_LOCAL_COMPUTER_OPS_PLAN.md`
5. `mcp-gateway/README.md`
6. `mcp-gateway/docs/contracts/notion-tools.md`
