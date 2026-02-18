export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`缺少环境变量: ${name}`);
  }
  return value;
}
