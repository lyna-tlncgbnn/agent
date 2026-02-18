"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Cog, Database, FolderOpen, HardDrive, Search, Shield } from "lucide-react";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";

type SearchProvider =
  | "auto"
  | "duckduckgo"
  | "bing"
  | "serpapi_google"
  | "serpapi_bing"
  | "serpapi_baidu"
  | "tavily";

type RuntimeConfig = {
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL: string;
  OPENAI_MODEL: string;
  NOTION_API_KEY: string;
  NOTION_PARENT_PAGE_ID: string;
  LOCAL_DB_PATH: string;
  SEARCH_PROVIDER: SearchProvider;
  SEARCH_TIMEOUT_MS: string;
  SEARCH_DEFAULT_MAX_RESULTS: string;
  SERPAPI_API_KEY: string;
  TAVILY_API_KEY: string;
  LOCAL_FILE_ALLOWED_ROOTS: string;
  LOCAL_FILE_MAX_READ_CHARS: string;
  LOCAL_FILE_MAX_LIST_ENTRIES: string;
  LOCAL_FILE_MAX_PDF_PAGES: string;
};

type TabKey = "general" | "search" | "local_access" | "mcp" | "storage";

type StorageStats = {
  dbPath: string;
  sessionCount: number;
  messageCount: number;
};

type SettingsPanelProps = {
  mode: "page" | "modal";
  onClose?: () => void;
};

const emptyConfig: RuntimeConfig = {
  OPENAI_API_KEY: "",
  OPENAI_BASE_URL: "",
  OPENAI_MODEL: "gpt-4o-mini",
  NOTION_API_KEY: "",
  NOTION_PARENT_PAGE_ID: "",
  LOCAL_DB_PATH: "",
  SEARCH_PROVIDER: "auto",
  SEARCH_TIMEOUT_MS: "8000",
  SEARCH_DEFAULT_MAX_RESULTS: "5",
  SERPAPI_API_KEY: "",
  TAVILY_API_KEY: "",
  LOCAL_FILE_ALLOWED_ROOTS: "",
  LOCAL_FILE_MAX_READ_CHARS: "12000",
  LOCAL_FILE_MAX_LIST_ENTRIES: "100",
  LOCAL_FILE_MAX_PDF_PAGES: "30"
};

const providerOptions: Array<{ value: SearchProvider; label: string }> = [
  { value: "auto", label: "自动（推荐）" },
  { value: "duckduckgo", label: "DuckDuckGo（免费）" },
  { value: "bing", label: "Bing RSS（免费）" },
  { value: "serpapi_google", label: "SerpAPI - Google（付费）" },
  { value: "serpapi_bing", label: "SerpAPI - Bing（付费）" },
  { value: "serpapi_baidu", label: "SerpAPI - 百度（付费）" },
  { value: "tavily", label: "Tavily（付费）" }
];

function splitAllowedRoots(raw: string): string[] {
  return raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeAllowedRoots(items: string[]): string {
  return items.join(";");
}

export function SettingsPanel({ mode }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [config, setConfig] = useState<RuntimeConfig>(emptyConfig);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("正在加载配置...");

  const [mcpBusy, setMcpBusy] = useState(false);
  const [mcpStatus, setMcpStatus] = useState("尚未检测");

  const [storageBusy, setStorageBusy] = useState(false);
  const [storageStatus, setStorageStatus] = useState("尚未读取");
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);

  const allowedRoots = useMemo(() => splitAllowedRoots(config.LOCAL_FILE_ALLOWED_ROOTS), [config.LOCAL_FILE_ALLOWED_ROOTS]);

  async function loadStorageStats() {
    try {
      const response = await fetch("/api/storage", { method: "GET" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "读取存储信息失败");
      }
      setStorageStats(data.stats as StorageStats);
      setStorageStatus("存储信息已更新");
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "读取失败");
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/settings", { method: "GET" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "加载配置失败");
        }

        if (!active) return;
        setConfig(data.config as RuntimeConfig);
        setStatus("配置已加载，修改后点击保存即可生效。");
      } catch (error) {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : "加载失败");
      }
    }

    void load();
    void loadStorageStats();

    return () => {
      active = false;
    };
  }, []);

  function onInputChange<K extends keyof RuntimeConfig>(key: K, value: RuntimeConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("正在保存配置...");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "保存失败");
      }

      setStatus("保存成功，新配置已生效。");
      await loadStorageStats();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function checkMcpGatewayHealth() {
    setMcpBusy(true);
    setMcpStatus("检测中...");

    try {
      const response = await fetch("/api/notion/parents?q=", { method: "GET" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "网关检测失败");
      }

      const count = Array.isArray(data?.items) ? data.items.length : 0;
      setMcpStatus(`网关链路正常，可读取目标页面（当前返回 ${count} 条）`);
    } catch (error) {
      setMcpStatus(error instanceof Error ? `网关异常：${error.message}` : "网关异常");
    } finally {
      setMcpBusy(false);
    }
  }

  async function clearStorage() {
    setStorageBusy(true);
    setStorageStatus("清空中...");

    try {
      const response = await fetch("/api/storage/clear", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "清空失败");
      }

      setStorageStatus("已清空本地会话数据");
      await loadStorageStats();
    } catch (error) {
      setStorageStatus(error instanceof Error ? error.message : "清空失败");
    } finally {
      setStorageBusy(false);
    }
  }

  async function pickAndAddAllowedRoot() {
    setPickingFolder(true);
    try {
      const response = await fetch("/api/local/folder-picker", { method: "GET" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "选择文件夹失败");
      }

      if (data?.cancelled) {
        return;
      }

      const selectedPath = typeof data?.path === "string" ? data.path.trim() : "";
      if (!selectedPath) {
        return;
      }

      const exists = allowedRoots.some((item) => item.toLowerCase() === selectedPath.toLowerCase());
      if (exists) {
        setStatus("该目录已在白名单中。");
        return;
      }

      const next = [...allowedRoots, selectedPath];
      onInputChange("LOCAL_FILE_ALLOWED_ROOTS", mergeAllowedRoots(next));
      setStatus("已添加白名单目录，请点击保存使其生效。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "选择文件夹失败");
    } finally {
      setPickingFolder(false);
    }
  }

  function removeAllowedRoot(target: string) {
    const next = allowedRoots.filter((item) => item.toLowerCase() !== target.toLowerCase());
    onInputChange("LOCAL_FILE_ALLOWED_ROOTS", mergeAllowedRoots(next));
    setStatus("已移除白名单目录，请点击保存使其生效。");
  }

  return (
    <section className={`settings-shell ${mode === "modal" ? "settings-shell-modal" : ""}`}>
      <aside className="settings-sidebar">
        <div className="settings-sidebar-top">
          {mode === "page" ? (
            <Link href="/" className="settings-close" title="返回聊天" aria-label="返回聊天">
              <ChevronLeft size={18} strokeWidth={2.6} />
            </Link>
          ) : null}
          <h2>设置</h2>
        </div>

        <nav className="settings-nav" aria-label="设置分类">
          <button
            type="button"
            className={`settings-nav-item ${activeTab === "general" ? "active" : "ghost"}`}
            onClick={() => setActiveTab("general")}
          >
            <Cog size={16} />
            <span>模型与 Notion</span>
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === "search" ? "active" : "ghost"}`}
            onClick={() => setActiveTab("search")}
          >
            <Search size={16} />
            <span>联网搜索</span>
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === "local_access" ? "active" : "ghost"}`}
            onClick={() => setActiveTab("local_access")}
          >
            <FolderOpen size={16} />
            <span>本地接入与权限</span>
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === "mcp" ? "active" : "ghost"}`}
            onClick={() => setActiveTab("mcp")}
          >
            <Database size={16} />
            <span>MCP 网关</span>
          </button>
          <button
            type="button"
            className={`settings-nav-item ${activeTab === "storage" ? "active" : "ghost"}`}
            onClick={() => setActiveTab("storage")}
          >
            <HardDrive size={16} />
            <span>数据存储</span>
          </button>
          <button type="button" className="settings-nav-item ghost" disabled>
            <Shield size={16} />
            <span>安全</span>
          </button>
        </nav>
      </aside>

      <section className="settings-content">
        <header className="settings-content-top">
          <div>
            <h1>
              {activeTab === "general"
                ? "常规"
                : activeTab === "search"
                  ? "联网搜索"
                  : activeTab === "local_access"
                    ? "本地接入与权限"
                    : activeTab === "mcp"
                      ? "MCP 网关"
                      : "数据存储"}
            </h1>
            <p>
              {activeTab === "general"
                ? "配置模型与 Notion 参数。"
                : activeTab === "search"
                  ? "选择搜索源并配置对应参数，支持免费与付费 Provider。"
                  : activeTab === "local_access"
                    ? "配置本地文件访问白名单与读取限制。"
                    : activeTab === "mcp"
                      ? "查看网关链路状态。"
                      : "管理本地 SQLite 路径与会话数据。"}
            </p>
          </div>
          {mode === "page" ? (
            <Link href="/" className="link-btn">返回聊天</Link>
          ) : null}
        </header>

        {activeTab === "general" ? (
          <section className="settings-card">
            <form onSubmit={onSubmit} className="settings-form modern">
              <label>
                <span>OPENAI_API_KEY</span>
                <input
                  type="password"
                  value={config.OPENAI_API_KEY}
                  onChange={(event) => onInputChange("OPENAI_API_KEY", event.target.value)}
                  placeholder="例如 OpenAI 或兼容平台 API Key"
                />
              </label>

              <label>
                <span>OPENAI_BASE_URL</span>
                <input
                  type="text"
                  value={config.OPENAI_BASE_URL}
                  onChange={(event) => onInputChange("OPENAI_BASE_URL", event.target.value)}
                  placeholder="OpenAI 兼容接口地址，可留空"
                />
              </label>

              <label>
                <span>OPENAI_MODEL</span>
                <input
                  type="text"
                  value={config.OPENAI_MODEL}
                  onChange={(event) => onInputChange("OPENAI_MODEL", event.target.value)}
                  placeholder="模型 ID"
                />
              </label>

              <label>
                <span>NOTION_API_KEY</span>
                <input
                  type="password"
                  value={config.NOTION_API_KEY}
                  onChange={(event) => onInputChange("NOTION_API_KEY", event.target.value)}
                  placeholder="Notion Integration Token"
                />
              </label>

              <label>
                <span>NOTION_PARENT_PAGE_ID（聊天保存默认父页面）</span>
                <input
                  type="text"
                  value={config.NOTION_PARENT_PAGE_ID}
                  onChange={(event) => onInputChange("NOTION_PARENT_PAGE_ID", event.target.value)}
                  placeholder="Notion 父页面 ID"
                />
              </label>

              <div className="settings-actions">
                <button type="submit" disabled={busy}>{busy ? "保存中..." : "保存配置"}</button>
              </div>
            </form>

            <div className="status">{status}</div>
          </section>
        ) : null}

        {activeTab === "search" ? (
          <section className="settings-card">
            <form onSubmit={onSubmit} className="settings-form modern">
              <label>
                <span>SEARCH_PROVIDER</span>
                <select
                  value={config.SEARCH_PROVIDER}
                  onChange={(event) => onInputChange("SEARCH_PROVIDER", event.target.value as SearchProvider)}
                >
                  {providerOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>SEARCH_TIMEOUT_MS</span>
                <input
                  type="text"
                  value={config.SEARCH_TIMEOUT_MS}
                  onChange={(event) => onInputChange("SEARCH_TIMEOUT_MS", event.target.value)}
                  placeholder="请求超时（毫秒），默认 8000"
                />
              </label>

              <label>
                <span>SEARCH_DEFAULT_MAX_RESULTS</span>
                <input
                  type="text"
                  value={config.SEARCH_DEFAULT_MAX_RESULTS}
                  onChange={(event) => onInputChange("SEARCH_DEFAULT_MAX_RESULTS", event.target.value)}
                  placeholder="默认返回条数，默认 5"
                />
              </label>

              {(config.SEARCH_PROVIDER === "serpapi_google" ||
                config.SEARCH_PROVIDER === "serpapi_bing" ||
                config.SEARCH_PROVIDER === "serpapi_baidu" ||
                config.SEARCH_PROVIDER === "auto") ? (
                <label>
                  <span>SERPAPI_API_KEY</span>
                  <input
                    type="password"
                    value={config.SERPAPI_API_KEY}
                    onChange={(event) => onInputChange("SERPAPI_API_KEY", event.target.value)}
                    placeholder="SerpAPI Key（Google/Bing/百度）"
                  />
                </label>
              ) : null}

              {(config.SEARCH_PROVIDER === "tavily" || config.SEARCH_PROVIDER === "auto") ? (
                <label>
                  <span>TAVILY_API_KEY</span>
                  <input
                    type="password"
                    value={config.TAVILY_API_KEY}
                    onChange={(event) => onInputChange("TAVILY_API_KEY", event.target.value)}
                    placeholder="Tavily API Key"
                  />
                </label>
              ) : null}

              <div className="settings-actions">
                <button type="submit" disabled={busy}>{busy ? "保存中..." : "保存搜索设置"}</button>
              </div>
            </form>

            <div className="status">{status}</div>
          </section>
        ) : null}

        {activeTab === "local_access" ? (
          <section className="settings-card mcp-card">
            <form onSubmit={onSubmit} className="settings-form modern">
              <div className="local-roots-panel">
                <div className="local-roots-header">
                  <span>本地文件白名单目录</span>
                  <button type="button" className="secondary" onClick={() => void pickAndAddAllowedRoot()} disabled={pickingFolder}>
                    {pickingFolder ? "选择中..." : "选择文件夹"}
                  </button>
                </div>
                {allowedRoots.length === 0 ? (
                  <p className="local-roots-empty">暂无白名单目录。点击“选择文件夹”添加。</p>
                ) : (
                  <div className="local-root-list">
                    {allowedRoots.map((root) => (
                      <div key={root} className="local-root-item">
                        <code>{root}</code>
                        <button type="button" className="danger-text" onClick={() => removeAllowedRoot(root)}>移除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label>
                <span>LOCAL_FILE_MAX_READ_CHARS（单次最大读取字符）</span>
                <input
                  type="text"
                  value={config.LOCAL_FILE_MAX_READ_CHARS}
                  onChange={(event) => onInputChange("LOCAL_FILE_MAX_READ_CHARS", event.target.value)}
                  placeholder="默认 12000"
                />
              </label>

              <label>
                <span>LOCAL_FILE_MAX_LIST_ENTRIES（单次最大列举条目）</span>
                <input
                  type="text"
                  value={config.LOCAL_FILE_MAX_LIST_ENTRIES}
                  onChange={(event) => onInputChange("LOCAL_FILE_MAX_LIST_ENTRIES", event.target.value)}
                  placeholder="默认 100"
                />
              </label>

              <label>
                <span>LOCAL_FILE_MAX_PDF_PAGES（单次最大 PDF 页数）</span>
                <input
                  type="text"
                  value={config.LOCAL_FILE_MAX_PDF_PAGES}
                  onChange={(event) => onInputChange("LOCAL_FILE_MAX_PDF_PAGES", event.target.value)}
                  placeholder="默认 30"
                />
              </label>

              <div className="settings-actions">
                <button type="submit" disabled={busy}>{busy ? "保存中..." : "保存本地接入配置"}</button>
              </div>
            </form>

            <div className="status">{status}</div>
          </section>
        ) : null}

        {activeTab === "mcp" ? (
          <section className="settings-card mcp-card">
            <div className="mcp-grid">
              <div className="mcp-item">
                <span>网关调用模式</span>
                <strong>stdio 子进程（每请求独立拉起）</strong>
              </div>
              <div className="mcp-item">
                <span>Notion 能力入口</span>
                <strong>`save_chat_answer` / `list_notion_targets`</strong>
              </div>
              <div className="mcp-item full">
                <span>链路检测</span>
                <div className="mcp-actions">
                  <button type="button" onClick={() => void checkMcpGatewayHealth()} disabled={mcpBusy}>
                    {mcpBusy ? "检测中..." : "检测网关"}
                  </button>
                  <p>{mcpStatus}</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "storage" ? (
          <section className="settings-card mcp-card">
            <form onSubmit={onSubmit} className="settings-form modern">
              <label>
                <span>LOCAL_DB_PATH（SQLite 文件路径）</span>
                <input
                  type="text"
                  value={config.LOCAL_DB_PATH}
                  onChange={(event) => onInputChange("LOCAL_DB_PATH", event.target.value)}
                  placeholder="例如 F:\\langchain-notion-assistant\\data\\assistant.db"
                />
              </label>

              <div className="settings-actions">
                <button type="submit" disabled={busy}>{busy ? "保存中..." : "保存存储配置"}</button>
              </div>
            </form>

            <div className="mcp-grid" style={{ marginTop: 12 }}>
              <div className="mcp-item">
                <span>当前数据库文件</span>
                <strong>{storageStats?.dbPath || "-"}</strong>
              </div>
              <div className="mcp-item">
                <span>会话数量</span>
                <strong>{storageStats?.sessionCount ?? 0}</strong>
              </div>
              <div className="mcp-item">
                <span>消息数量</span>
                <strong>{storageStats?.messageCount ?? 0}</strong>
              </div>
              <div className="mcp-item full">
                <span>数据维护</span>
                <div className="mcp-actions">
                  <button type="button" onClick={() => setClearDialogOpen(true)} disabled={storageBusy}>
                    {storageBusy ? "处理中..." : "清空本地会话"}
                  </button>
                  <p>{storageStatus}</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </section>

      <ConfirmDialog
        open={clearDialogOpen}
        title="清空本地数据"
        description="确定清空所有本地会话和消息吗？此操作不可恢复。"
        confirmText="清空"
        loading={storageBusy}
        danger
        onCancel={() => setClearDialogOpen(false)}
        onConfirm={() => {
          void clearStorage().finally(() => {
            setClearDialogOpen(false);
          });
        }}
      />
    </section>
  );
}
