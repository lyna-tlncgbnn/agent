# Gateway MCP 实施计划（Notion 官方 MCP + 自定义工具封装）

更新时间：2026-02-14

## 1. 目标

构建统一 `Gateway MCP`，让前端、LangChain、自动化任务只对接一个 Notion 能力入口：
1. 优先调用官方 MCP 能力
2. 官方缺失能力由自定义工具补齐
3. 主项目 Notion 调用统一迁移到网关

## 2. 当前进度

### 已完成
1. `mcp-gateway` 子项目搭建完成（可构建、可独立调试）
2. 自定义工具：
- `save_chat_answer`
- `list_notion_targets`
3. 官方透传最小能力：
- `official_notion_search`
- 路由模式 `custom | official | hybrid`
4. 主项目 Notion 相关接口已迁移到 gateway
5. 当前主项目已采用 stdio 按请求拉起 gateway 子进程

### 未完成
1. 官方 OAuth 完整会话流（PKCE/刷新/持久化）
2. `official_notion_create_page`
3. `ingest_bookmark`
4. Edge 扩展自动收藏链路联调
5. 队列/重试/去重（生产级稳定性）

## 3. 分阶段状态

## Phase A（完成）
1. 工程骨架、配置、日志、错误包装
2. 健康检查与基础工具

## Phase B（完成）
1. Notion 写入工具
2. 目标页面查询工具
3. 主项目保存链路迁移

## Phase C（部分完成）

### 已完成
1. 官方 MCP adapter
2. `official_notion_search`
3. 路由策略切换

### 待完成
1. 官方 OAuth 完整流
2. `official_notion_create_page`

## Phase D（未开始）
1. `ingest_bookmark`
2. 异步队列与重试
3. Edge 扩展联调

## 4. 下一步建议

1. 先补完 Phase C（`official_notion_create_page` + OAuth）
2. 再推进 Phase D（自动收藏入库）
