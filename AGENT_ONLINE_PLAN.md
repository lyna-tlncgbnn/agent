# Agent Online Capability Plan (v2)

## 0. 实施原则
1. 先最小可用：先跑通 Tool Calling + `web_search`
2. 不破坏现有体验：保持 `/api/chat` 和 SSE 不变
3. 统一通过 MCP：主应用只做编排，不直连第三方搜索 API

## M1 - 文档与架构冻结
### Tasks
1. 更新需求文档（本次完成）
2. 明确 Agent 编排层接口与最大调用步数
3. 明确搜索 provider 抽象

### Exit Criteria
1. 团队对 Phase 1 范围达成一致
2. 关键文件和接口命名固定

## M2 - MCP `web_search` 工具（最小版）
### Tasks
1. 新增 `mcp-gateway/src/tools/web-search.ts`
2. 在 `mcp-gateway/src/server.ts` 注册 `web_search`
3. 工具实现：
   - 输入校验（zod）
   - 调用搜索 provider
   - 输出标准结构（text/data/sources）
4. 通过环境变量注入 provider key/base url（如需要）

### Exit Criteria
1. `npm run build`（mcp-gateway）通过
2. MCP client 能成功调用 `web_search`

## M3 - 主应用 Agent Tool Calling（核心）
### Tasks
1. 在 `lib/mcp-gateway-client.ts` 增加 `callWebSearchTool`
2. 在 `lib/llm.ts` 重构为工具调用循环：
   - Step A: 模型判断是否需要工具 + 生成 tool call
   - Step B: 后端执行工具并回填工具结果消息
   - Step C: 模型生成最终回答
3. 保护机制：
   - `MAX_TOOL_STEPS = 3`
   - 工具白名单校验
   - tool error fallback

### Exit Criteria
1. 天气和搜索都能通过同一套 Tool Calling 流程触发
2. 非联网问题不会误触工具

## M4 - 回答可追溯与前端展示
### Tasks
1. 回答末尾附“来源”列表（title + url）
2. 保持现有 markdown 渲染兼容
3. 前端可选增加“工具调用中”状态（非阻塞）

### Exit Criteria
1. 用户可直接看到引用来源
2. SSE 渲染与会话保存正常

## M5 - 验证与回归
### 必测用例
1. “今天 AI 领域有什么新闻？” -> 命中 `web_search`
2. “北京今天温度多少？” -> 命中 `get_weather`
3. “帮我总结这段话” -> 不调用工具
4. 搜索服务不可用 -> 明确报错 + graceful fallback

### 验证命令
1. `npm run build`（mcp-gateway）
2. `npx tsc --noEmit`（主项目）

## M6 - 后续增强（Phase 2）
1. 多工具并行/串行自动规划
2. 查询缓存与去重
3. 可信源优先级和域名策略
4. 结构化引用卡片
