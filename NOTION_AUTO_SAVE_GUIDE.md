# Notion 自动保存功能说明

## 1. 功能概览
当你在提问里明确表达“把回答保存到 Notion”时，系统会在回答生成完成后自动调用 Notion 保存工具，无需手动点击“保存”按钮。

支持在同一句里指定文档标题，例如：
- “总结一下，然后保存到 Notion，命名为 你好”
- “请把上面内容存到 notion，标题为 项目复盘”

## 2. 触发规则
自动保存会在以下条件同时满足时触发：
1. 用户最新一条消息包含 `notion`（不区分大小写）
2. 用户最新一条消息包含保存意图关键词（如“保存/存到/存入/写入/save/同步”）
3. 不包含明确否定（如“不要保存到 notion”）

标题提取支持：
1. `命名为 xxx`
2. `命名成 xxx`
3. `标题为 xxx`
4. `标题叫 xxx`
5. `title: xxx` / `title = xxx`

如果未识别到标题，会使用默认标题 `AI 回答`。

## 3. 执行流程（后端）
1. `POST /api/chat` 接收消息
2. 正常执行聊天流（SSE `delta`）
3. 服务端累计完整回答文本
4. 流结束后，如果命中自动保存规则：
   - 调用 `callSaveChatAnswerTool(...)`
   - 写入 Notion
   - 通过 SSE 返回保存结果事件
5. 返回 `done`

SSE 事件新增：
1. `notion_saved`：自动保存成功，包含 `pageUrl` 和 `title`
2. `notion_save_error`：自动保存失败，包含错误信息

## 4. 前端表现
前端收到事件后会在状态栏提示：
1. 成功：`Auto-saved to Notion: <pageUrl>`
2. 失败：`Auto-save to Notion failed: <error>`

## 5. 使用示例
1. 自动保存并命名：
   - `总结一下这段内容，并保存到 notion，命名为 你好`
2. 自动保存但不指定标题：
   - `给我一个三点总结，然后保存到 Notion`
3. 明确不保存（不会触发）：
   - `先回答我，不要保存到 notion`

## 6. 配置前提
要成功保存到 Notion，需要：
1. 在设置里配置 `NOTION_API_KEY`
2. 配置 `NOTION_PARENT_PAGE_ID`
3. Notion 父页面已共享给 Integration
4. `mcp-gateway` 已完成构建（`npm run build`）

## 7. 当前限制
1. 自动保存只看“最新一条用户消息”，不回溯更早消息
2. 标题提取基于规则匹配，不是模型语义抽取
3. 当前前端是状态文本提示，尚未做独立“保存回执卡片”

## 8. 关键代码位置
1. 自动保存判定与执行：
   - `app/api/chat/route.ts`
2. Notion 保存工具调用：
   - `lib/mcp-gateway-client.ts`
3. SSE 事件类型：
   - `app/chat/types.ts`
4. 前端事件处理：
   - `app/chat/hooks/use-chat-stream.ts`
