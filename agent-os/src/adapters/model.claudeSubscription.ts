// Subscription-backed model provider: drives Claude through the Claude Code CLI
// in headless mode, authenticated by a Max-subscription OAuth token
// (CLAUDE_CODE_OAUTH_TOKEN) — no per-token API key/billing.
//
// The CLI is the officially-supported way to use a Claude *subscription*
// programmatically; it handles the OAuth headers/endpoints. Network egress
// (e.g. via HTTPS_PROXY / a VPN on the host) must reach Anthropic — on a blocked
// network the call fails and we surface a clear error instead of crashing the run.
//
// NOTE: not exercised by the offline test-suite (needs the CLI + a real token +
// egress). It is wired in index.ts only when CLAUDE_CODE_OAUTH_TOKEN is set.

import { spawn } from 'child_process';
import { ModelMessage, ModelProvider, ToolSchema } from '../ports/model';
import { ModelTurn } from '../domain/types';

function flatten(system: string, messages: ModelMessage[]): string {
  // The CLI takes a single prompt; render the conversation as plain text. The
  // system prompt is passed separately via --append-system-prompt.
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === 'assistant') lines.push('Ассистент: ' + m.content);
    else if (m.role === 'tool') lines.push('Результат инструмента: ' + m.content);
    else lines.push('Пользователь: ' + m.content);
  }
  return lines.join('\n\n');
}

function runCli(bin: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // stdin must be closed (not an open pipe): in -p mode the CLI otherwise
    // waits for stdin and stalls. We pass the prompt via argv, so ignore stdin.
    const child = spawn(bin, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('claude CLI timed out'));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error('claude CLI exited ' + code + ': ' + (err || out).slice(0, 500)));
    });
  });
}

export class ClaudeSubscriptionModelProvider implements ModelProvider {
  constructor(
    private readonly opts: { model?: string; bin?: string; timeoutMs?: number } = {},
  ) {}

  async complete(args: {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
  }): Promise<ModelTurn> {
    const bin = this.opts.bin ?? 'claude';
    const prompt = flatten(args.system, args.messages);
    // Allow several turns so the agent can use the CLI's built-in tools (e.g.
    // server-side web search, which routes via the same relay) and still reach a
    // final answer — with --max-turns 1 any tool_use ends in error_max_turns.
    const cliArgs = ['-p', prompt, '--output-format', 'json', '--max-turns', '8'];
    if (this.opts.model) cliArgs.push('--model', this.opts.model);
    if (args.system) cliArgs.push('--append-system-prompt', args.system);

    const raw = await runCli(bin, cliArgs, this.opts.timeoutMs ?? 180000);

    let text = raw.trim();
    let tokensIn = 0;
    let tokensOut = 0;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.result === 'string') text = parsed.result;
      else if (typeof parsed.text === 'string') text = parsed.text;
      const u = parsed.usage || (parsed.message && parsed.message.usage);
      if (u) {
        tokensIn = u.input_tokens ?? 0;
        tokensOut = u.output_tokens ?? 0;
      }
    } catch {
      // Non-JSON output: keep the raw text.
    }

    // This adapter returns text completions; structured tool-use via the
    // subscription path is a follow-up. agent-os' own runtime still orchestrates.
    return { text, toolCalls: [], tokensIn, tokensOut, model: this.opts.model };
  }
}
