import { NextResponse } from "next/server";

const folderPickerScript = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms

$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$owner.Size = New-Object System.Drawing.Size(1, 1)
$owner.Opacity = 0

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "选择要加入白名单的文件夹"
$dialog.ShowNewFolderButton = $true

try {
  $owner.Show()
  $owner.Activate()
  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
    $selectedPath = $dialog.SelectedPath
    if (-not [string]::IsNullOrWhiteSpace($selectedPath)) {
      Write-Output $selectedPath
    }
  }
} finally {
  $owner.Close()
  $owner.Dispose()
  $dialog.Dispose()
}
`;

function normalizeSelectedPath(raw: string): string {
  return raw.replace(/\u0000/g, "").trim();
}

function decodeStdout(buffer: Buffer | string): string {
  if (typeof buffer === "string") {
    return buffer;
  }

  const utf8 = Buffer.from(buffer).toString("utf8");
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  return Buffer.from(buffer).toString("utf16le");
}

async function pickFolderByPowerShell(): Promise<string | null> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        folderPickerScript
      ],
      {
        encoding: "buffer",
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024
      }
    );

    const selectedPath = normalizeSelectedPath(decodeStdout(stdout));
    return selectedPath || null;
  } catch (error) {
    const raw = error as { stderr?: Buffer | string; message?: string };
    const stderrText = raw.stderr ? decodeStdout(raw.stderr) : "";
    const detail = stderrText || raw.message || "unknown";
    throw new Error(`PICKER_INIT_FAILED: ${detail}`);
  }
}

export async function GET() {
  if (process.platform !== "win32") {
    return NextResponse.json(
      { error: "当前仅支持 Windows 文件夹选择器，请手动输入路径。" },
      { status: 400 }
    );
  }

  try {
    const selectedPath = await pickFolderByPowerShell();
    if (!selectedPath) {
      return NextResponse.json({ cancelled: true });
    }

    return NextResponse.json({ path: selectedPath, provider: "powershell-openfiledialog" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件夹选择失败";
    const isInitFailed = message.startsWith("PICKER_INIT_FAILED:");
    return NextResponse.json(
      {
        error: isInitFailed ? "文件夹选择器启动失败，请重试。" : "文件夹选择失败",
        detail: message
      },
      { status: 500 }
    );
  }
}
