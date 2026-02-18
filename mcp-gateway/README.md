# mcp-gateway

`mcp-gateway` 是主项目的 MCP 子服务，统一承接 Notion 能力。

## 目标

1. 主项目只连接一个 MCP 入口
2. 自定义工具与官方 MCP 能力统一调度
3. 支持路由模式：`custom | official | hybrid`

## 当前状态（2026-02-14）

1. Phase A：完成
2. Phase B：完成
3. Phase C：部分完成
4. Phase D：未开始

## 已有工具

1. `ping`
2. `save_chat_answer`
3. `list_notion_targets`
4. `official_notion_search`

## 与主项目的集成方式

当前主项目通过 `stdio` 模式按请求拉起网关子进程：
1. 日常运行主项目时，不需要单独常驻启动 gateway
2. 但需要 gateway 已构建（存在 `dist/server.js`）

## 技术栈

1. TypeScript
2. `@modelcontextprotocol/sdk`
3. `@notionhq/client`
4. Node.js

## 目录结构

```text
mcp-gateway/
  src/
    adapters/                # 官方 MCP 透传适配
    config/                  # 配置加载
    errors/                  # 错误模型
    logging/                 # 结构化日志
    notion/                  # Notion 业务逻辑
    tools/                   # MCP tools
    transport/               # health server 等
  docs/contracts/            # 工具契约
  README.md
```

## 快速开始

```bash
cd F:\langchain-notion-assistant\mcp-gateway
npm install
npm run build
```

如需单独调试服务：

```bash
npm run dev
```

## 配置优先级

1. `mcp-gateway/.gateway-config.json`
2. 环境变量
3. 默认值

## 常用配置

1. `NOTION_ROUTE_MODE`
2. `OFFICIAL_MCP_URL`
3. `OFFICIAL_MCP_BEARER_TOKEN`
4. `OFFICIAL_SEARCH_TOOL_NAME`

Notion 业务配置默认读取根目录 `.runtime-config.json`：
1. `NOTION_API_KEY`
2. `NOTION_PARENT_PAGE_ID`

## 路线图

1. 完成官方 OAuth 完整流（PKCE + 刷新 + 持久化）
2. 增加 `official_notion_create_page`
3. 实现 `ingest_bookmark`（Edge 收藏自动入库）
