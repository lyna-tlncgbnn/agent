# Notion Tools Contract (Gateway MCP)

更新时间：2026-02-13

本文档定义 Gateway 中与 Notion 相关的 MCP 工具契约。

## 1. `save_chat_answer`

用途：将聊天回答保存为 Notion 页面。

输入：

```json
{
  "title": "可选，页面标题",
  "answer": "必填，回答正文",
  "sourceType": "chat_answer 或 bookmark_article，可选",
  "parentPageId": "可选，覆盖默认父页面"
}
```

输出：

```json
{
  "pageId": "...",
  "pageUrl": "...",
  "parentPageId": "...",
  "markdown": "...",
  "sourceType": "chat_answer"
}
```

## 2. `list_notion_targets`

用途：返回“默认父页面 + 默认父页面下的子页面”，用于前端下拉选择。

输入：

```json
{
  "query": "可选，按页面标题模糊搜索"
}
```

输出：

```json
{
  "defaultParent": {
    "id": "...",
    "title": "...",
    "type": "default_parent",
    "isDefault": true
  },
  "items": [
    {
      "id": "...",
      "title": "...",
      "type": "default_parent 或 child_page",
      "isDefault": true 或 false
    }
  ]
}
```

规则：

1. `items` 中包含默认父页面本身。
2. `items` 还包含默认父页面下的所有 `child_page`。
3. `query` 不为空时，按 `title` 进行大小写不敏感过滤。

## 3. `official_notion_search`

用途：官方 MCP 搜索透传（并支持 `hybrid` 降级）。

输入：

```json
{
  "query": "必填，搜索关键词",
  "pageSize": 10
}
```

输出（official 成功）：

```json
{
  "mode": "official",
  "content": [],
  "structuredContent": {}
}
```

输出（hybrid 降级到 custom）：

```json
{
  "mode": "custom",
  "items": [],
  "defaultParent": {}
}
```

配置项：

1. `NOTION_ROUTE_MODE=custom|official|hybrid`
2. `OFFICIAL_MCP_URL`
3. `OFFICIAL_MCP_BEARER_TOKEN`
4. `OFFICIAL_SEARCH_TOOL_NAME`（默认 `notion-search`）

## 4. 错误码（当前约定）

1. `CONFIG_MISSING`：关键配置缺失（如 `NOTION_API_KEY`、`NOTION_PARENT_PAGE_ID`）。
2. `OFFICIAL_AUTH_REQUIRED`：未提供官方 MCP 透传令牌。
3. `OFFICIAL_CALL_FAILED`：官方 MCP 调用失败。
4. `TOOL_NOT_FOUND`：调用了未注册工具。
5. `INTERNAL_ERROR`：未归类的内部错误。

说明：

- MCP 返回错误时，`isError=true`，文本格式为：`ERROR(<CODE>): <message>`。
