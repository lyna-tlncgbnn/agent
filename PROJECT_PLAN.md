# LangChain JS/TS 智能助手项目规划

更新时间：2026-02-14

## 1. 项目目标

构建一个基于 `LangChain (JS/TS)` 的智能助手，核心链路：
1. 聊天问答
2. 一键保存 AI 回答到 Notion
3. Edge 新收藏自动识别并入库 Notion

## 2. 里程碑进度

## M1（已完成）
1. 聊天问答主链路跑通
2. AI 回答可保存到 Notion
3. 设置页支持运行时配置（无需重启）
4. 保存时可自定义标题与选择保存页面

## M2（进行中）

### 已完成
1. Notion 保存目标页面搜索/选择优化
2. 前端对话 UI GPT 风格化（流式 + Markdown/GFM 渲染）
3. 本地数据层从 localStorage 升级到 SQLite
4. 多会话能力：新建会话、历史会话切换、消息持久化
5. 设置页新增“数据存储”分类：
- 配置 SQLite 路径（`LOCAL_DB_PATH`）
- 查看会话/消息统计
- 清空本地数据
6. 聊天页与设置页往返时保持当前会话定位

### 未完成
1. Edge 扩展监听新增收藏
2. 网页正文抽取 + LLM 摘要转 Markdown
3. 收藏自动写入 Notion（来源 URL、时间、标签）

## M3（未开始）
1. 去重（URL 标准化 + 内容哈希）
2. 失败重试与死信
3. 可观测性（日志、任务状态）

## M4（未开始）
1. Notion 分类策略
2. 自定义摘要模板
3. 保存前编辑与审核

## 3. 当前架构（落地版）

1. 前端：Next.js App Router + React + TypeScript
2. 模型编排：LangChain JS
3. Notion 接入：统一经 `mcp-gateway`
4. 本地持久化：SQLite（`better-sqlite3`）

## 4. 已落地 API（主项目）

1. `POST /api/chat`
2. `GET/POST /api/settings`
3. `GET/POST /api/sessions`
4. `GET/POST /api/sessions/[id]/messages`
5. `DELETE /api/sessions/[id]`
6. `GET /api/storage`
7. `POST /api/storage/clear`
8. `POST /api/notion/save`
9. `GET /api/notion/parents`

## 5. 下一步执行顺序（建议）

1. 完成 M2 自动收藏链路（Edge 扩展 + 入库管道）
2. 接入任务队列与重试（M3）
3. 再做内容模板与高级体验（M4）
