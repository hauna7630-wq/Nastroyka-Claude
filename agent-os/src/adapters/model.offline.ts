// Offline fallback provider — used in production when no LLM is configured
// (no subscription token, no API key). It never calls the network, so runs
// complete deterministically instead of crashing; replies clearly say the brain
// is offline. Swap in a real provider (subscription or API) to make agents think.

import { ModelMessage, ModelProvider, ToolSchema } from '../ports/model';
import { ModelTurn } from '../domain/types';

export class OfflineModelProvider implements ModelProvider {
  async complete(args: {
    system: string;
    messages: ModelMessage[];
    tools: ToolSchema[];
  }): Promise<ModelTurn> {
    const lastUser = [...args.messages].reverse().find((m) => m.role === 'user');
    const q = (lastUser?.content ?? '').slice(0, 300);
    const text =
      'Офлайн-режим: языковая модель не подключена, поэтому это служебный ответ, ' +
      'а не работа специалиста. Запрос принят: «' + q + '». ' +
      'Подключите подписку (CLAUDE_CODE_OAUTH_TOKEN) или API-ключ, чтобы получать ' +
      'настоящие профессиональные ответы.';
    return { text, toolCalls: [], tokensIn: 0, tokensOut: 0 };
  }
}
