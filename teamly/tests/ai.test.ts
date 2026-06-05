import { chunkText } from '@/lib/ai/chunk';
import { cosineSim, l2normalize, toVectorLiteral } from '@/lib/ai/vector';
import { HashEmbedder, HASH_EMBED_DIM } from '@/lib/ai/hashEmbedder';
import { ExtractiveChatModel, NO_ANSWER } from '@/lib/ai/extractiveChat';

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('hello world')).toEqual(['hello world']);
    expect(chunkText('   ')).toEqual([]);
  });
  it('splits long text into overlapping chunks covering the whole input', () => {
    const text = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const chunks = chunkText(text, { maxChars: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('word0');
    expect(chunks[chunks.length - 1]).toContain('word59');
  });
});

describe('vector helpers', () => {
  it('cosineSim + normalize', () => {
    expect(cosineSim([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0);
    expect(l2normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
  });
  it('formats a pgvector literal', () => {
    expect(toVectorLiteral([0.5, -1, 2])).toBe('[0.5,-1,2]');
  });
});

describe('HashEmbedder', () => {
  const embedder = new HashEmbedder();

  it('is deterministic and produces normalised vectors of the right dim', async () => {
    const [a] = await embedder.embed(['онбординг сотрудника регламент']);
    const [b] = await embedder.embed(['онбординг сотрудника регламент']);
    expect(a).toHaveLength(HASH_EMBED_DIM);
    expect(a).toEqual(b);
    expect(cosineSim(a, a)).toBeCloseTo(1);
  });

  it('ranks related text closer than unrelated text', async () => {
    const [q] = await embedder.embed(['как проходит онбординг нового сотрудника']);
    const [related] = await embedder.embed([
      'Онбординг нового сотрудника: регламент и первые шаги в компании',
    ]);
    const [unrelated] = await embedder.embed(['прогноз погоды на завтра дождь и ветер']);
    expect(cosineSim(q, related)).toBeGreaterThan(cosineSim(q, unrelated));
    expect(cosineSim(q, related)).toBeGreaterThan(0.2);
  });
});

describe('ExtractiveChatModel (no hallucination)', () => {
  const chat = new ExtractiveChatModel();
  it('refuses with no context', async () => {
    const a = await chat.answer('вопрос', []);
    expect(a).toEqual({ answer: NO_ANSWER, refused: true, citations: [] });
  });
  it('answers from context and cites distinct pages', async () => {
    const a = await chat.answer('вопрос', [
      { pageId: 'p1', pageTitle: 'Онбординг', text: 'Добро пожаловать в команду.', score: 0.9 },
      { pageId: 'p1', pageTitle: 'Онбординг', text: 'Вторая часть.', score: 0.7 },
    ]);
    expect(a.refused).toBe(false);
    expect(a.answer).toContain('Добро пожаловать');
    expect(a.citations).toEqual([{ pageId: 'p1', title: 'Онбординг' }]);
  });
});
