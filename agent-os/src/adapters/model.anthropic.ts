// Production model provider backed by the Anthropic SDK (latest Claude).
//
// NOTE (scaffold limitation): the simplified ModelProvider port represents the
// conversation as flat {user|assistant|tool} string messages. A fully-faithful
// integration must preserve the assistant `tool_use` blocks alongside their
// matching `tool_result` blocks. That is a deliberate follow-up; this adapter
// maps the simplified shape and is not exercised by the test-suite.

import Anthropic from '@anthropic-ai/sdk';
import { ModelMessage, ModelProvider, ToolSchema } from '../ports/model';
import { ModelTurn, ToolCall } from '../domain/types';

export class AnthropicModelProvider implements ModelProvider {
  private readonly client: Anthropic;

  constructor(
    private readonly opts: { apiKey: string; model: string; maxTokens?: number },
  ) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
  }

  async complete(args: {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
  }): Promise<ModelTurn> {
    const tools: Anthropic.Tool[] = args.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));

    const messages: Anthropic.MessageParam[] = args.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId ?? '',
              content: m.content,
            },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    const res = await this.client.messages.create({
      model: this.opts.model,
      max_tokens: this.opts.maxTokens ?? 1024,
      system: args.system,
      messages,
      tools,
    });

    let text = '';
    const toolCalls: ToolCall[] = [];
    for (const block of res.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    return {
      text: text || undefined,
      toolCalls,
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
    };
  }
}
