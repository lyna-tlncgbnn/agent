# 使用手册（USER GUIDE）

本文面向第一次接触项目的使用者。

## 1. 启动前准备

1. 安装依赖（主项目 + `mcp-gateway`）。
2. 先构建 `mcp-gateway`：`npm run build`。
3. 启动主项目：`npm run dev`。
4. 打开 `http://localhost:3100`。

## 2. 首次配置步骤

在聊天页点击左下角“设置”，按顺序配置：

1. 模型与 Notion
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- 可选 `OPENAI_BASE_URL`
- `NOTION_API_KEY`
- `NOTION_PARENT_PAGE_ID`

2. 联网搜索
- `SEARCH_PROVIDER` 建议先用 `auto`
- `SEARCH_TIMEOUT_MS` 默认 `8000`
- `SEARCH_DEFAULT_MAX_RESULTS` 默认 `5`
- 若选 SerpAPI/Tavily，填写对应 API Key

3. 本地接入与权限
- 点击“选择文件夹”把允许访问的目录加入白名单
- 设置读取限制：
  - `LOCAL_FILE_MAX_READ_CHARS`
  - `LOCAL_FILE_MAX_LIST_ENTRIES`
  - `LOCAL_FILE_MAX_PDF_PAGES`

4. 数据存储
- 可查看 SQLite 路径与会话统计
- 可清空本地会话数据

## 3. 日常使用场景

## 3.1 普通问答
直接输入问题即可，不一定触发工具。

## 3.2 联网搜索问答
问实时问题（新闻、天气、股价等）时，Agent 会自动调用 `web_search` 或 `get_weather`。

建议提问方式：
- `今天发生了哪些 AI 相关新闻？`
- `英伟达当前市值大概多少？请给来源`

## 3.3 本地文件问答
先确保目录在白名单内，再提问。

示例：
- `列出 D:\papers 下的文件`
- `帮我找 AutoGLM 的 pdf`
- `读取这篇论文并总结关键贡献`

## 3.4 本地文件操作
示例：
- `把总结写入 D:\notes\summary.txt`
- `把 D:\notes\summary.txt 复制到 D:\archive\summary.txt`
- `把 D:\tmp\a.txt 删除（确认删除）`

说明：删除工具需要显式确认参数，Agent 默认会更谨慎。

## 3.5 保存到 Notion

### 手动保存
在 AI 回答下方点击保存按钮。

### 自动保存
提问时包含“保存到 Notion”意图即可。

示例：
- `总结一下这篇论文，并保存到 notion`
- `把总结保存到 notion，命名为 AutoGLM总结`

## 4. 工具执行过程显示

当 Agent 在调用工具时，前端会在“正在生成”消息下显示短暂过程：
- 当前是第几步
- 调用了哪个工具
- 成功/失败摘要

回答完成后，该过程面板自动消失，仅保留最终答案。

## 5. 常见问题

1. 搜索失败
- 检查 `SEARCH_PROVIDER` 与 API Key 配置
- 在 `auto` 模式下会尝试多个 provider，仍失败时查看服务是否可达

2. 无法访问本地文件
- 检查目标路径是否在白名单
- 绝对路径优先；相对路径依赖白名单解析

3. 保存 Notion 失败
- 检查 `NOTION_API_KEY` 与 `NOTION_PARENT_PAGE_ID`
- 确认父页面已共享给 Integration

4. 设置已保存但未生效
- 确认保存成功提示
- 若遇到缓存问题，刷新页面再试

## 6. 推荐测试清单

1. 聊天：普通问题不触发工具
2. 搜索：实时问题触发 `web_search`
3. 本地：能找到并读取白名单目录文件
4. 自动保存：带“保存到 Notion”请求时可自动入库
5. 文件操作：创建/写入/复制/移动/删除各测一次
