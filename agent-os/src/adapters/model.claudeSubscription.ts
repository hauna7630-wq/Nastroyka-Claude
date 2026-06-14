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
    // Inactivity timeout: the CLI can legitimately think for a while, so we only
    // abort after `timeoutMs` of total silence — any stdout/stderr byte re-arms it.
    let timer: NodeJS.Timeout;
    const arm = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('claude CLI timed out'));
      }, timeoutMs);
    };
    arm();
    child.stdout.on('data', (d) => { out += d.toString(); arm(); });
    child.stderr.on('data', (d) => { err += d.toString(); arm(); });
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

interface StreamResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

// Streaming variant: --output-format stream-json emits one JSON object per line
// (JSONL). With --include-partial-messages it also surfaces the raw Anthropic
// SSE events (content_block_delta → delta.text_delta) so we can forward live
// text tokens. The final `result` event is authoritative for the answer + usage.
// On ANY parsing/process failure the caller falls back to the buffered path, so
// streaming can never break a run — it only makes a healthy run feel live.
function runCliStreaming(
  bin: string,
  args: string[],
  timeoutMs: number,
  onText: (delta: string) => void,
): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    let buf = '';
    let resultText = '';
    let assistantText = '';
    let streamedText = '';
    let tokensIn = 0;
    let tokensOut = 0;
    // Inactivity timeout (NOT wall-clock): as long as the model keeps streaming
    // bytes the timer is re-armed, so a long-but-progressing answer is never
    // killed mid-stream. Only `timeoutMs` of true silence aborts the call.
    // Message kept matching the buffered one so humanizeRunError maps it cleanly.
    let timer: NodeJS.Timeout;
    const arm = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('claude CLI timed out (stream idle)'));
      }, timeoutMs);
    };
    arm();

    const handleEvent = (ev: any): void => {
      if (!ev || typeof ev !== 'object') return;
      // Anthropic SSE event (wrapped by the CLI under `event` when
      // --include-partial-messages is on).
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
        const t = String(ev.delta.text || '');
        if (t) {
          streamedText += t;
          try {
            onText(t);
          } catch {
            // a misbehaving sink must not abort the stream
          }
        }
      } else if (ev.type === 'message_delta' && ev.usage) {
        if (typeof ev.usage.output_tokens === 'number') tokensOut = ev.usage.output_tokens;
      } else if (ev.type === 'message_start' && ev.message && ev.message.usage) {
        if (typeof ev.message.usage.input_tokens === 'number') tokensIn = ev.message.usage.input_tokens;
      }
    };

    const handleLine = (line: string): void => {
      const s = line.trim();
      if (!s) return;
      let obj: any;
      try {
        obj = JSON.parse(s);
      } catch {
        return; // ignore partial/non-JSON noise
      }
      // CLI envelope types: system | assistant | user | result | stream_event.
      if (obj.type === 'stream_event' && obj.event) {
        handleEvent(obj.event);
        return;
      }
      // Some CLI builds emit the raw SSE event object directly.
      if (typeof obj.type === 'string' && obj.type.indexOf('content_block') === 0) {
        handleEvent(obj);
        return;
      }
      if (obj.type === 'assistant' && obj.message && Array.isArray(obj.message.content)) {
        const parts = obj.message.content
          .filter((b: any) => b && b.type === 'text' && typeof b.text === 'string')
          .map((b: any) => b.text);
        if (parts.length) assistantText = parts.join('');
        const u = obj.message.usage;
        if (u) {
          if (typeof u.input_tokens === 'number') tokensIn = u.input_tokens;
          if (typeof u.output_tokens === 'number') tokensOut = u.output_tokens;
        }
      } else if (obj.type === 'result') {
        if (typeof obj.result === 'string') resultText = obj.result;
        const u = obj.usage;
        if (u) {
          if (typeof u.input_tokens === 'number') tokensIn = u.input_tokens;
          if (typeof u.output_tokens === 'number') tokensOut = u.output_tokens;
        }
      }
    };

    child.stdout.on('data', (d) => {
      arm(); // re-arm the inactivity timeout on every chunk of streamed output
      buf += d.toString();
      let nl = buf.indexOf('\n');
      while (nl >= 0) {
        handleLine(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
        nl = buf.indexOf('\n');
      }
    });
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (buf.trim()) handleLine(buf);
      if (code !== 0) {
        reject(new Error('claude CLI (stream) exited ' + code + ': ' + (err || '').slice(0, 500)));
        return;
      }
      // Authoritative final answer: result > full assistant message > streamed.
      const text = (resultText || assistantText || streamedText).trim();
      if (!text) {
        reject(new Error('claude CLI (stream) produced no text'));
        return;
      }
      resolve({ text, tokensIn, tokensOut });
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
    onText?: (delta: string) => void;
    capabilities?: { webSearch?: boolean; codeExec?: boolean };
  }): Promise<ModelTurn> {
    // Streaming is strictly best-effort: only attempted when a live-token sink
    // is supplied, and ANY failure falls back to the proven buffered path so a
    // healthy run can never be broken by the streaming experiment.
    if (args.onText) {
      try {
        return await this.completeStreaming(args, args.onText);
      } catch {
        // fall through to buffered
      }
    }
    return this.completeBuffered(args);
  }

  // Allow the CLI's built-in WebSearch/WebFetch tools, but only for agents whose
  // allowlist includes web_search (capabilities.webSearch). Gated by env so it
  // can be disabled fleet-wide without a redeploy: CLAUDE_CLI_WEB_SEARCH=0.
  private webSearchArgs(capabilities?: { webSearch?: boolean }): string[] {
    if (!capabilities?.webSearch) return [];
    if (process.env.CLAUDE_CLI_WEB_SEARCH === '0') return [];
    return ['--allowedTools', 'WebSearch', '--allowedTools', 'WebFetch'];
  }

  // Let the coder actually RUN code / write files via the CLI's Bash/Write/Read
  // tools — but only for agents whose allowlist includes code_exec AND only when
  // explicitly enabled fleet-wide with CLAUDE_CLI_CODE_TOOLS=1. Default OFF: these
  // tools execute arbitrary commands in the worker container (which holds DB creds
  // and the OAuth token), so turning them on is a conscious, opt-in decision.
  private codeToolsArgs(capabilities?: { codeExec?: boolean }): string[] {
    if (!capabilities?.codeExec) return [];
    if (process.env.CLAUDE_CLI_CODE_TOOLS !== '1') return [];
    // bypassPermissions is REQUIRED in headless -p mode: otherwise the CLI blocks
    // on an interactive "Allow?" prompt the user can never answer (it stalls / the
    // model invents a fake «нажми Allow»). This is the «full auto» execution path;
    // the «confirmation» mode never reaches here (codeExec capability is withheld).
    return [
      '--allowedTools', 'Bash', '--allowedTools', 'Write', '--allowedTools', 'Read',
      '--permission-mode', 'bypassPermissions',
    ];
  }

  private async completeStreaming(
    args: {
      system: string;
      messages: ModelMessage[];
      tools: ToolSchema[];
      capabilities?: { webSearch?: boolean; codeExec?: boolean };
    },
    onText: (delta: string) => void,
  ): Promise<ModelTurn> {
    const bin = this.opts.bin ?? 'claude';
    const prompt = flatten(args.system, args.messages);
    const cliArgs = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--max-turns',
      '8',
      ...this.webSearchArgs(args.capabilities),
      ...this.codeToolsArgs(args.capabilities),
    ];
    if (this.opts.model) cliArgs.push('--model', this.opts.model);
    if (args.system) cliArgs.push('--append-system-prompt', args.system);

    const r = await runCliStreaming(bin, cliArgs, this.opts.timeoutMs ?? 180000, onText);
    return {
      text: r.text,
      toolCalls: [],
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      model: this.opts.model,
    };
  }

  private async completeBuffered(args: {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
    capabilities?: { webSearch?: boolean; codeExec?: boolean };
  }): Promise<ModelTurn> {
    const bin = this.opts.bin ?? 'claude';
    const prompt = flatten(args.system, args.messages);
    // Allow several turns so the agent can use the CLI's built-in tools (e.g.
    // server-side web search, which routes via the same relay) and still reach a
    // final answer — with --max-turns 1 any tool_use ends in error_max_turns.
    const cliArgs = ['-p', prompt, '--output-format', 'json', '--max-turns', '8',
      ...this.webSearchArgs(args.capabilities), ...this.codeToolsArgs(args.capabilities)];
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
