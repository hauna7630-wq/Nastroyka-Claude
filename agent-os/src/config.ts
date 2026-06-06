// Typed environment config. Kept dependency-free (no dotenv) so the package
// installs lean; load a .env via `node --env-file` or your process manager.

export interface Config {
  databaseUrl: string;
  redisUrl: string;
  anthropicApiKey: string;
  anthropicModel: string;
  allowlistDomains: string[];
  toolCpuMs: number;
  toolMemMb: number;
  // HTTP server.
  port: number;
}

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    databaseUrl: env.DATABASE_URL ?? '',
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? '',
    // Default to a capable, cost-reasonable current Claude model.
    anthropicModel: env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    allowlistDomains: csv(env.ALLOWLIST_DOMAINS),
    toolCpuMs: Number(env.TOOL_CPU_MS ?? 5000),
    toolMemMb: Number(env.TOOL_MEM_MB ?? 256),
    port: Number(env.PORT ?? 3000),
  };
}
