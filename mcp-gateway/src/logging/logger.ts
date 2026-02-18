export type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  constructor(private readonly minLevel: LogLevel) {}

  private shouldLog(level: LogLevel): boolean {
    return levels[level] >= levels[this.minLevel];
  }

  private write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;
    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(fields || {})
    };
    process.stderr.write(`${JSON.stringify(payload)}\n`);
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.write("error", message, fields);
  }
}
