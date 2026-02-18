# MCP Gateway

`mcp-gateway` 是本项目的工具网关服务，负责把 Notion、联网搜索、本地文件能力统一暴露为 MCP tools。

## 1. 作用定位

1. 给主应用提供统一工具入口
2. 让主应用只做 Agent 编排，不直接耦合第三方 SDK
3. 在网关层统一做参数校验、错误包装、日志记录

## 2. 当前已实现工具

1. Notion
- `save_chat_answer`
- `list_notion_targets`
- `official_notion_search`

2. 联网
- `get_weather`
- `web_search`

3. 本地文件与操作
- `get_local_access_policy`
- `list_local_files`
- `find_local_files`
- `read_text_file`
- `extract_pdf_text`
- `read_office_file`
- `create_text_file`
- `write_text_file`
- `append_text_file`
- `copy_path`
- `move_path`
- `rename_path`
- `delete_path`

4. 诊断
- `ping`

完整参数说明见：`docs/contracts/tools-reference.md`

## 3. 启动方式

## 3.1 被主项目调用（推荐）
主项目通过 stdio 子进程按请求拉起网关。

特点：
1. 不需要单独常驻启动网关
2. 但必须先构建出 `dist/server.js`

命令：

```bash
cd F:\langchain-notion-assistant\mcp-gateway
npm install
npm run build
```

然后启动主项目：

```bash
cd F:\langchain-notion-assistant
npm run dev
```

## 3.2 独立调试网关

```bash
cd F:\langchain-notion-assistant\mcp-gateway
npm run dev
```

## 4. 配置来源

网关有两类配置来源。

## 4.1 网关自身配置（`gateway-config`）
优先级：
1. `mcp-gateway/.gateway-config.json`
2. 环境变量
3. 默认值

关键项：
- `GATEWAY_NAME`
- `GATEWAY_VERSION`
- `GATEWAY_LOG_LEVEL`
- `GATEWAY_HEALTH_PORT`
- `NOTION_ROUTE_MODE` (`custom` / `official` / `hybrid`)
- `OFFICIAL_MCP_URL`
- `OFFICIAL_MCP_BEARER_TOKEN`
- `OFFICIAL_SEARCH_TOOL_NAME`

## 4.2 业务运行时配置（`runtime-config`）
网关会读取项目根目录 `.runtime-config.json`（与主项目共享）。

关键项：
- `NOTION_API_KEY`
- `NOTION_PARENT_PAGE_ID`
- `SEARCH_PROVIDER`
- `SEARCH_TIMEOUT_MS`
- `SEARCH_DEFAULT_MAX_RESULTS`
- `SERPAPI_API_KEY`
- `TAVILY_API_KEY`
- `LOCAL_FILE_ALLOWED_ROOTS`
- `LOCAL_FILE_MAX_READ_CHARS`
- `LOCAL_FILE_MAX_LIST_ENTRIES`
- `LOCAL_FILE_MAX_PDF_PAGES`

## 5. 常见开发命令

```bash
cd F:\langchain-notion-assistant\mcp-gateway
npm install
npm run build
npm run dev
```

## 6. 错误与排查

1. 搜索失败
- 检查 `SEARCH_PROVIDER` 与 API key
- `auto` 模式会自动回退多个 provider

2. 本地文件访问失败
- 检查 `LOCAL_FILE_ALLOWED_ROOTS` 是否包含目标目录
- 检查路径是否超出白名单

3. 删除失败
- `delete_path` 需要 `confirm="DELETE"`

4. Notion 保存失败
- 检查 `NOTION_API_KEY`
- 检查 `NOTION_PARENT_PAGE_ID`
- 确认父页面已共享给 integration

## 7. 目录结构

```text
mcp-gateway/
  src/
    adapters/               # 官方 MCP 透传适配
    config/                 # 配置加载
    errors/                 # 统一错误结构
    logging/                # 结构化日志
    notion/                 # Notion 相关逻辑
    tools/                  # MCP 工具实现
    transport/              # health server 等
  docs/contracts/
    tools-reference.md      # 工具接口总表（重点）
```

## 8. 后续计划

1. 官方 Notion OAuth 完整流程
2. 更多官方能力透传（如 create page）
3. 高风险本地操作策略开关
