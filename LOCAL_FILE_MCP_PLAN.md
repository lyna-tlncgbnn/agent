# Local File MCP Implementation Plan (v1)

## 0. 实施策略
1. 先最小可用：先打通“列文件 -> 读文件 -> 总结 -> 存 Notion”
2. 保持可控安全：仅白名单目录可访问
3. 接口前置设计：为未来多文件类型/更多工具保留扩展位

---

## M1 - 配置与安全基座

### 目标
先建立“本地文件访问边界”，不让能力失控。

### Tasks
1. 扩展运行时配置（主项目 + gateway 读取）
   - `LOCAL_FILE_ALLOWED_ROOTS`
   - `LOCAL_FILE_MAX_READ_CHARS`
   - `LOCAL_FILE_MAX_LIST_ENTRIES`
   - `LOCAL_FILE_MAX_PDF_PAGES`
2. 新增路径工具函数（网关）
   - 规范化路径
   - 白名单判断
   - 错误码封装（`PATH_NOT_ALLOWED`）

### 产出文件（建议）
1. `mcp-gateway/src/config/runtime-config.ts`（扩展字段）
2. `mcp-gateway/src/tools/local-path-utils.ts`（新建）

### Exit Criteria
1. 非白名单路径访问被拒绝
2. 配置缺失有默认值和明确错误

---

## M2 - 本地文件工具 MVP

### 目标
具备“列文件 + 读文本 + 读 PDF”能力。

### Tasks
1. 新增工具 `list_local_files`
2. 新增工具 `read_text_file`
3. 新增工具 `extract_pdf_text`
4. 在 `mcp-gateway/src/server.ts` 注册并接入调用分支

### 技术建议
1. `list_local_files`
   - Node `fs.readdir` + `fs.stat`
2. `read_text_file`
   - Node `fs.readFile('utf8')`
   - 截断到 `max_chars`
3. `extract_pdf_text`
   - 使用轻量库（如 `pdf-parse`）
   - 优先全文抽取后分页标记（MVP 可先不做精准页码）

### 产出文件（建议）
1. `mcp-gateway/src/tools/list-local-files.ts`
2. `mcp-gateway/src/tools/read-text-file.ts`
3. `mcp-gateway/src/tools/extract-pdf-text.ts`

### Exit Criteria
1. 三个工具可通过 MCP client 调用
2. 网关构建通过

---

## M3 - 主应用接入（Agent 工具调用）

### 目标
让 Agent 能调用这些工具并完成本地文件任务。

### Tasks
1. 扩展 MCP client
   - `callListLocalFilesTool`
   - `callReadTextFileTool`
   - `callExtractPdfTextTool`
2. 在 `lib/llm.ts` 的工具白名单中加入上述工具
3. 更新 Agent 系统提示
   - 明确本地文件任务标准流程：
     - 定位文件 -> 读取 -> 总结 -> 可选保存 Notion

### Exit Criteria
1. 具体指令可执行
2. 抽象任务可由 Agent 规划执行

---

## M4 - 论文总结工作流（端到端）

### 目标
完成你最核心场景：读论文并存 Notion。

### 当前状态（2026-02-16）
1. 已完成：当用户在问题中明确提出“保存到 Notion”时，聊天回答完成后会自动保存到 Notion。
2. 已完成：支持在同一句中指定标题（例如“命名为 你好”）。
3. 待完成：针对“论文总结”输出结构模板（研究问题/方法/结论/局限）。
4. 待完成：保存成功后的更显式回执卡片（当前为状态提示）。

### Tasks
1. 增加总结模板策略（论文场景）
   - 研究问题
   - 方法
   - 实验结论
   - 局限性
   - 我的理解（通俗解释）
2. 当用户要求“保存到 Notion”时，调用 `save_chat_answer`
3. 返回保存回执（链接）

### Exit Criteria
1. 指令：“读 paper.pdf，总结并保存到 Notion”一次完成
2. 有 Notion 页面 URL 回执

---

## M5 - 质量与稳定性优化

### 目标
减少错误，提高可维护性。

### Tasks
1. 大文本分块总结（map-reduce）
2. 工具调用重试与超时策略
3. 结构化日志（toolName/path/duration）
4. 增加错误提示友好度

### Exit Criteria
1. 大文件不会明显卡死
2. 错误可定位，可恢复

---

## Phase 2 扩展计划

### P2-1 文件类型扩展
1. docx / xlsx / pptx 读取工具
2. image OCR 工具

### P2-2 知识化能力
1. 文档分块索引
2. 向量检索问答

### P2-3 权限治理
1. 设置页可管理白名单目录
2. 按目录配置是否允许读取 PDF/文本

---

## 测试用例（建议）

### 用例 A：具体命令
1. “列出 D:\\papers 有哪些文件”
2. “读取 D:\\papers\\intro.md 内容”
3. “读取 D:\\papers\\paper.pdf 并总结三点”

### 用例 B：抽象任务
1. “帮我把 D 盘那篇论文读完并讲给我听”
2. “总结后保存到 Notion”

### 用例 C：异常
1. 白名单外路径
2. 文件不存在
3. PDF 抽取失败
4. Notion 保存失败

---

## 验证命令
1. `npm run build`（`mcp-gateway`）
2. `npx tsc --noEmit`（主项目）
