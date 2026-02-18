# M5 计划：本地电脑操作能力扩展（v1）

## 1. 目标
在现有“本地读取 + 联网 + Notion 保存”基础上，扩展 Agent 的本地文件操作能力：
1. 读取 Office 文档（docx/xlsx/pptx）
2. 创建与写入文件
3. 删除文件/目录
4. 复制、移动、重命名文件/目录

原则：先做最小可用且可控安全，再做批量与高级自动化。

## 2. 范围定义

### 2.1 In Scope（M5）
1. 新增 MCP 工具（读/写/删/复制/移动）
2. 统一白名单目录权限校验
3. 统一错误码与操作回执
4. Agent 可自主调用这些工具完成任务

### 2.2 Out of Scope（M5 之后）
1. 系统级操作（进程、注册表、网络配置）
2. 跨磁盘高风险批量变更默认开启
3. OCR、图片理解（后续阶段）

## 3. 工具清单（M5）

### 3.1 读取类
1. `read_office_file`
   - 输入：`{ path: string, max_chars?: number }`
   - 支持：`.docx .xlsx .pptx`
   - 输出：`{ path, format, truncated, content }`

### 3.2 写入类
1. `create_text_file`
   - 输入：`{ path: string, content?: string, overwrite?: boolean }`
2. `write_text_file`
   - 输入：`{ path: string, content: string, overwrite?: boolean }`
3. `append_text_file`
   - 输入：`{ path: string, content: string }`

### 3.3 变更类
1. `delete_path`
   - 输入：`{ path: string, recursive?: boolean, safe_mode?: boolean }`
2. `copy_path`
   - 输入：`{ from: string, to: string, overwrite?: boolean }`
3. `move_path`
   - 输入：`{ from: string, to: string, overwrite?: boolean }`
4. `rename_path`
   - 输入：`{ path: string, new_name: string }`

### 3.4 查询类（推荐）
1. `find_local_files`
   - 输入：`{ query: string, roots?: string[], max_entries?: number }`
   - 行为：默认遍历全部白名单目录，按顺序返回命中

## 4. 里程碑

## M5.1 - 能力与权限基座
### Tasks
1. 扩展 `local-path-utils`，加入写操作通用校验
2. 新增危险操作保护（覆盖/删除前的明确策略）
3. 定义统一错误码（`PATH_NOT_ALLOWED`、`ALREADY_EXISTS`、`DELETE_DENIED`）

### Exit Criteria
1. 所有新工具都复用同一套权限校验
2. 绝对路径/相对路径行为一致

## M5.2 - Office 读取能力
### Tasks
1. 新增 `read-office-file.ts`
2. 选型：`mammoth`(docx) + `xlsx` + `pptx` 解析库（或等价方案）
3. 文本归一化与截断策略复用 `max_chars`

### Exit Criteria
1. 可读取 docx/xlsx/pptx 并供 Agent 总结

## M5.3 - 文件写入与变更能力
### Tasks
1. 新增 `create_text_file` / `write_text_file` / `append_text_file`
2. 新增 `copy_path` / `move_path` / `rename_path` / `delete_path`
3. 所有操作返回结构化回执（源路径、目标路径、结果）

### Exit Criteria
1. Agent 能执行“生成文件 -> 写内容 -> 移动归档”完整链路

## M5.4 - Agent 集成
### Tasks
1. `mcp-gateway/src/server.ts` 注册新工具
2. `lib/mcp-gateway-client.ts` 新增调用方法
3. `lib/llm.ts` 工具白名单与提示词更新
4. 为高风险工具增加“先确认再执行”策略

### Exit Criteria
1. Agent 可自主规划并调用新工具
2. 危险动作在无确认时不会直接执行

## M5.5 - 测试与回归
### 必测用例
1. “读取 D:\\docs\\a.docx 并总结”
2. “创建 report.md 并写入三点结论”
3. “把 report.md 复制到 D:\\archive\\report.md”
4. “删除 D:\\tmp\\old.txt”（安全模式）
5. 白名单外路径操作应被拒绝

### 验证命令
1. `npm run build`（`mcp-gateway`）
2. `npx tsc --noEmit`（主项目）

## 5. 改动面评估（你问的核心）

### 5.1 主要工作量在 MCP Gateway
1. 新工具实现
2. 参数校验与安全策略
3. 工具注册与日志

### 5.2 主项目改动较小，但不是 0
1. `lib/mcp-gateway-client.ts`：增加新工具调用函数
2. `lib/llm.ts`：把新工具暴露给 Agent（白名单 + 提示词 + tool loop 分支）
3. （可选）设置页：新增策略项（是否允许删除/覆盖等）

结论：你的理解是对的，主项目不需要“大改 UI/架构”，但要做少量“编排层”接线。

## 6. 推荐执行顺序（最小可用）
1. `read_office_file`
2. `create_text_file` + `write_text_file`
3. `copy_path` + `move_path`
4. `delete_path`（最后上，默认安全模式）
5. `find_local_files`（提升多白名单体验）
