# Search Provider Config Requirements

## Goal
在设置页支持可切换搜索源，并让 `web_search` 工具按配置运行。

## Functional Requirements
1. 新增配置字段（持久化到 `.runtime-config.json`）：
   - `SEARCH_PROVIDER`
   - `SEARCH_TIMEOUT_MS`
   - `SEARCH_DEFAULT_MAX_RESULTS`
   - `SERPAPI_API_KEY`
   - `TAVILY_API_KEY`
2. 设置页新增“联网搜索”模块：
   - 可选择 provider：`auto` / `duckduckgo` / `bing` / `serpapi_google` / `serpapi_bing` / `serpapi_baidu` / `tavily`
   - 可配置超时和默认返回条数
   - 按 provider 显示对应 API Key 输入
3. `web_search` 运行时读取配置并路由：
   - `auto`: duckduckgo -> bing -> tavily -> serpapi_google
   - 指定 provider：仅调用该 provider
4. 配置缺失要可诊断：
   - 缺少 `SERPAPI_API_KEY` / `TAVILY_API_KEY` 时返回明确错误

## Non-Functional Requirements
1. 向后兼容：不影响天气工具与聊天 SSE 协议
2. 可扩展：新增 provider 不改 settings 基础结构
3. 可观察：错误返回包含 provider 和超时信息

## Acceptance
1. 设置页可保存搜索 provider 与配置
2. 重启后配置仍生效
3. `web_search` 按选中 provider 查询
4. `mcp-gateway` build 和主项目 tsc 通过
