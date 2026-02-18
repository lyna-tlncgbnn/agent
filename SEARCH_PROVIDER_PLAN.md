# Search Provider Config Plan

1. 数据模型扩展
- 扩展 `lib/runtime-config.ts` 与 `app/api/settings/route.ts` 字段。

2. 设置页改造
- `app/settings/page.tsx` 新增“联网搜索”标签。
- 增加 provider 选择、超时、默认返回条数、API Key 条件表单。

3. 网关读取配置
- `mcp-gateway/src/config/runtime-config.ts` 增加搜索配置字段读取。

4. 搜索工具路由
- `mcp-gateway/src/tools/web-search.ts` 按 provider 选择执行：
  - 免费：DuckDuckGo、Bing RSS
  - 付费：SerpAPI(Google/Bing/百度)、Tavily
- `auto` 模式按优先级 fallback。

5. 验证
- `npm run build`（mcp-gateway）
- `npx tsc --noEmit`（主项目）
