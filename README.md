# LangChain Notion Assistant

一个基于 `Next.js + LangChain + MCP` 的中文智能 Agent 应用。

它已经不是“纯聊天 Demo”，而是一个可调用工具的本地 Agent：
- 能联网搜索并给出来源
- 能访问你授权的本地目录并读取文件
- 能执行常见本地文件操作（创建/写入/复制/移动/删除）
- 能把回答自动保存到 Notion

## 1. 当前能力（已实现）

### 1.1 Chat + Agent
- 多会话聊天（SQLite 持久化）
- 模型自主 Tool Calling 循环（最多 3 步）
- 工具执行过程前端可见（流式阶段显示，完成后自动消失）

### 1.2 联网搜索
- `web_search` 工具已接入
- 支持 provider：
  - `auto`
  - `duckduckgo`
  - `bing`
  - `serpapi_google`
  - `serpapi_bing`
  - `serpapi_baidu`
  - `tavily`
- 支持超时与默认结果数配置

### 1.3 本地文件与本地操作
- 白名单目录访问控制（必须先授权目录）
- 已支持工具：
  - `list_local_files`
  - `find_local_files`
  - `read_text_file`
  - `extract_pdf_text`
  - `read_office_file`（docx/xlsx/pptx）
  - `create_text_file`
  - `write_text_file`
  - `append_text_file`
  - `copy_path`
  - `move_path`
  - `rename_path`
  - `delete_path`（需确认参数）

### 1.4 Notion 能力
- 手动保存回答到 Notion
- 在提问里明确说“保存到 Notion”时自动保存
- 支持在提问中指定标题（例如“命名为 XXX”）
- 支持目标页面选择

### 1.5 设置中心（弹窗）
- 模型与 Notion
- 联网搜索
- 本地接入与权限（支持文件夹选择器）
- MCP 网关检测
- 数据存储（SQLite 路径、统计、清空）

## 2. 快速开始

## 2.1 环境要求
- Node.js 18+
- Windows（若使用“选择文件夹”系统对话框）

## 2.2 安装依赖

```bash
cd F:\langchain-notion-assistant
npm install

cd F:\langchain-notion-assistant\mcp-gateway
npm install
npm run build
```

## 2.3 启动

```bash
cd F:\langchain-notion-assistant
npm run dev
```

访问：
- 聊天页：`http://localhost:3100`

## 2.4 首次配置
打开设置，至少填好：
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- （可选）`OPENAI_BASE_URL`
- `NOTION_API_KEY`
- `NOTION_PARENT_PAGE_ID`

若要本地文件能力，还需要：
- 在“本地接入与权限”里添加白名单目录

## 3. 配置来源与优先级

运行时配置读取优先级：
1. `.runtime-config.json`
2. 环境变量
3. 代码默认值

主要配置字段：
- 模型：`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- Notion：`NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID`
- 搜索：`SEARCH_PROVIDER`, `SEARCH_TIMEOUT_MS`, `SEARCH_DEFAULT_MAX_RESULTS`, `SERPAPI_API_KEY`, `TAVILY_API_KEY`
- 本地：`LOCAL_FILE_ALLOWED_ROOTS`, `LOCAL_FILE_MAX_READ_CHARS`, `LOCAL_FILE_MAX_LIST_ENTRIES`, `LOCAL_FILE_MAX_PDF_PAGES`
- 存储：`LOCAL_DB_PATH`

## 4. 常用测试指令

- 联网搜索：`今天 AI 圈有什么重要新闻？`
- 天气：`重庆今天和明天的天气如何？`
- 本地查找：`帮我找一下叫 AutoGLM 的论文 pdf`
- 读 + 总结：`读取 D:\papers\paper.pdf，总结核心贡献`
- 保存 Notion：`把刚才总结保存到 Notion，命名为 AutoGLM总结`
- 本地写文件：`把总结写入 D:\notes\summary.txt`

## 5. 项目结构

```text
F:\langchain-notion-assistant
  app/                 # Next.js 页面与 API
  lib/                 # Agent 编排、MCP client、配置、存储
  mcp-gateway/         # MCP 网关与工具实现
  docs/                # 当前文档（推荐先看）
```

## 6. 文档导航

- `docs/USER_GUIDE.md`：使用手册（从 0 到可用）
- `docs/ROADMAP.md`：当前进度与后续计划
- `docs/ARCHITECTURE.md`：系统架构与执行链路

## 7. 已知限制

- 本地“选择文件夹”API 目前仅支持 Windows
- PDF 抽取对扫描版文档效果有限
- Tool Calling 当前最大步数为 3（可后续配置化）

## 8. 开发校验

```bash
cd F:\langchain-notion-assistant
npx tsc --noEmit

cd F:\langchain-notion-assistant\mcp-gateway
npm run build
```
