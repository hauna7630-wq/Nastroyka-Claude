// Typed environment config. Kept dependency-free (no dotenv) so the package
// installs lean; load a .env via `node --env-file` or your process manager.

export interface Config {
  databaseUrl: string;
  redisUrl: string;
  anthropicApiKey: string;
  anthropicModel: string;
  // Optional base URL override — point at a proxy/relay to reach Anthropic from a
  // network where the official endpoint is blocked (e.g. RU). Empty = official API.
  anthropicBaseUrl: string;
  // Max-subscription OAuth token (from `claude setup-token`). When set, agents run
  // on the subscription via the Claude CLI instead of a per-token API key.
  claudeOauthToken: string;
  // Claude CLI timeout. For the streaming path this is an INACTIVITY timeout
  // (reset on every token) so a long-but-progressing answer is never killed; for
  // the buffered path it is the total wall-clock budget. Tunable without redeploy.
  claudeCliTimeoutMs: number;
  allowlistDomains: string[];
  toolCpuMs: number;
  toolMemMb: number;
  tavilyApiKey: string;
  // Optional Perplexity key — preferred web-search provider for the agent-os
  // web_search tool (API/tool path) when set; falls back to Tavily.
  perplexityApiKey: string;
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
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL ?? '',
    claudeOauthToken: env.CLAUDE_CODE_OAUTH_TOKEN ?? '',
    claudeCliTimeoutMs: Number(env.CLAUDE_CLI_TIMEOUT_MS ?? 300000),
    allowlistDomains: csv(env.ALLOWLIST_DOMAINS),
    toolCpuMs: Number(env.TOOL_CPU_MS ?? 5000),
    toolMemMb: Number(env.TOOL_MEM_MB ?? 256),
    tavilyApiKey: env.TAVILY_API_KEY ?? '',
    perplexityApiKey: env.PERPLEXITY_API_KEY ?? '',
    port: Number(env.PORT ?? 3000),
  };
}
