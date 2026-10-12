export type Env = Readonly<Record<string, string | undefined>>;

export function envString(env: Env, key: string, fallback: string): string {
  const value = env[key];
  return value === undefined || value === '' ? fallback : value;
}

export function envInt(env: Env, key: string, fallback: number): number {
  const value = env[key];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`Environment variable ${key} must be an integer, got "${value}"`);
  return parsed;
}
