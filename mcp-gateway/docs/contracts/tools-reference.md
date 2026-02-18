# MCP Tools Reference

更新时间：2026-02-18

本文列出 `mcp-gateway` 当前所有可调用工具、参数和约束。

## 1. 通用说明

1. 所有工具都通过 MCP `callTool(name, arguments)` 调用。
2. 网关统一返回：
- `content[0].text`：人类可读文本
- `structuredContent`：结构化结果（推荐程序消费）
3. 错误返回：
- `isError: true`
- `content[0].text` 形如 `ERROR(CODE): message`

## 2. 工具总览

| Tool | 分类 | 说明 |
| --- | --- | --- |
| `ping` | 诊断 | 网关连通性检测 |
| `save_chat_answer` | Notion | 保存聊天回答到 Notion |
| `list_notion_targets` | Notion | 列出默认父页面和子页面 |
| `official_notion_search` | Notion 官方 | 官方 MCP 搜索透传 |
| `get_weather` | 联网 | 天气查询 |
| `web_search` | 联网 | 网页搜索 |
| `get_local_access_policy` | 本地 | 查看白名单与限制 |
| `list_local_files` | 本地 | 列目录 |
| `find_local_files` | 本地 | 白名单内按名称搜索 |
| `read_text_file` | 本地 | 读取文本文件 |
| `extract_pdf_text` | 本地 | 提取 PDF 文本 |
| `read_office_file` | 本地 | 读取 docx/xlsx/pptx |
| `create_text_file` | 本地写入 | 创建文本文件 |
| `write_text_file` | 本地写入 | 覆盖写文本文件 |
| `append_text_file` | 本地写入 | 追加文本文件 |
| `copy_path` | 本地变更 | 复制文件或目录 |
| `move_path` | 本地变更 | 移动文件或目录 |
| `rename_path` | 本地变更 | 重命名文件或目录 |
| `delete_path` | 本地危险操作 | 删除文件或目录 |

## 3. 详细接口

## 3.1 `ping`
参数：
```json
{ "message": "optional" }
```
约束：`message` 可选字符串。

## 3.2 `save_chat_answer`
参数：
```json
{
  "answer": "必填",
  "title": "可选",
  "sourceType": "chat_answer",
  "parentPageId": "可选"
}
```
约束：
- `answer` 必填
- `sourceType` 可选，枚举：`chat_answer` / `bookmark_article`

返回 `structuredContent` 关键字段：
- `pageId`
- `pageUrl`
- `parentPageId`
- `markdown`
- `sourceType`

## 3.3 `list_notion_targets`
参数：
```json
{ "query": "可选" }
```
返回 `structuredContent`：
- `defaultParent`
- `items[]`

## 3.4 `official_notion_search`
参数：
```json
{
  "query": "必填",
  "pageSize": 10
}
```
约束：
- `query` 必填
- `pageSize` 范围 `1-50`，默认 `10`

## 3.5 `get_weather`
参数：
```json
{
  "query": "必填，如 北京",
  "days": 1
}
```
约束：
- `query` 必填
- `days` 范围 `1-3`（可选）

## 3.6 `web_search`
参数：
```json
{
  "query": "必填",
  "max_results": 5
}
```
约束：
- `query` 必填，1-200 字符
- `max_results` 范围 `1-10`（可选）

返回 `structuredContent`：
- `provider`
- `query`
- `results[]`（`title/url/snippet`）
- `sources[]`（`title/url`）

## 3.7 `get_local_access_policy`
参数：
```json
{}
```
返回 `structuredContent`：
- `allowedRoots`
- `allowedRootCount`
- `maxReadChars`
- `maxListEntries`
- `maxPdfPages`

## 3.8 `list_local_files`
参数：
```json
{
  "path": "必填",
  "recursive": false,
  "max_entries": 100
}
```
约束：
- `path` 必填
- 路径必须在白名单目录内

返回 `structuredContent`：
- `root`
- `queryPath`
- `recursive`
- `truncated`
- `count`
- `items[]`

## 3.9 `find_local_files`
参数：
```json
{
  "query": "必填",
  "roots": ["可选根目录"],
  "max_entries": 100,
  "include_dirs": true
}
```
约束：
- `query` 必填
- `roots` 可选，不传时搜索全部白名单

返回 `structuredContent`：
- `query`
- `rootCount`
- `count`
- `truncated`
- `items[]`（含 `root/path/name/type`）

## 3.10 `read_text_file`
参数：
```json
{
  "path": "必填",
  "max_chars": 12000
}
```
约束：
- `max_chars` 范围 `100-200000`
- 实际会再受全局策略上限约束

返回 `structuredContent`：
- `path`
- `truncated`
- `totalChars`
- `returnedChars`
- `content`

## 3.11 `extract_pdf_text`
参数：
```json
{
  "path": "必填",
  "max_pages": 30
}
```
约束：
- `max_pages` 范围 `1-300`
- 实际会受全局 `LOCAL_FILE_MAX_PDF_PAGES` 限制

返回 `structuredContent`：
- `path`
- `totalPages`
- `returnedPages`
- `truncated`
- `text`

## 3.12 `read_office_file`
参数：
```json
{
  "path": "必填",
  "max_chars": 12000
}
```
约束：
- 支持扩展名：`.docx`, `.xlsx`, `.pptx`
- `max_chars` 范围 `100-200000`

返回 `structuredContent`：
- `path`
- `format`（`docx|xlsx|pptx`）
- `truncated`
- `totalChars`
- `returnedChars`
- `content`

## 3.13 `create_text_file`
参数：
```json
{
  "path": "必填",
  "content": "可选",
  "overwrite": false
}
```
返回 `structuredContent`：
- `path`
- `created`
- `overwritten`
- `bytes`

## 3.14 `write_text_file`
参数：
```json
{
  "path": "必填",
  "content": "必填",
  "overwrite": true
}
```
返回 `structuredContent`：
- `path`
- `overwritten`
- `bytes`

## 3.15 `append_text_file`
参数：
```json
{
  "path": "必填",
  "content": "必填"
}
```
返回 `structuredContent`：
- `path`
- `appendedBytes`

## 3.16 `copy_path`
参数：
```json
{
  "from": "必填",
  "to": "必填",
  "overwrite": false
}
```
返回 `structuredContent`：
- `from`
- `to`
- `copiedType`（`file|dir`）
- `overwritten`

## 3.17 `move_path`
参数：
```json
{
  "from": "必填",
  "to": "必填",
  "overwrite": false
}
```
返回 `structuredContent`：
- `from`
- `to`
- `movedType`（`file|dir`）
- `overwritten`

## 3.18 `rename_path`
参数：
```json
{
  "path": "必填",
  "new_name": "必填"
}
```
约束：
- `new_name` 不能包含 `/` 或 `\\`

返回 `structuredContent`：
- `from`
- `to`
- `renamedType`（`file|dir`）

## 3.19 `delete_path`
参数：
```json
{
  "path": "必填",
  "recursive": false,
  "confirm": "DELETE"
}
```
约束：
- `confirm` 实际上必填且必须为 `DELETE`，否则拒绝执行
- 删除目录时通常需要 `recursive: true`

返回 `structuredContent`：
- `path`
- `deletedType`（`file|dir`）

## 4. 安全与限制

1. 本地路径必须命中白名单目录
2. 读取/列举/PDF 页数受全局限制
3. 删除工具必须显式确认
4. 白名单未配置时，本地工具会拒绝执行

## 5. 与主项目集成

主项目通过 `lib/mcp-gateway-client.ts` 统一调用这些工具。
如果新增工具，需要同步修改：
1. `mcp-gateway/src/server.ts`（注册）
2. `lib/mcp-gateway-client.ts`（客户端方法与类型）
3. `lib/llm.ts`（工具白名单与调用分支）
