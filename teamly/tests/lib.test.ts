import { extractText, previewText } from '@/lib/tiptap';
import { buildPageTree, descendantIds, FlatPage } from '@/lib/tree';
import { can, authorize, ForbiddenError } from '@/lib/rbac';
import { slugify, uniqueSlug } from '@/lib/slug';
import { signSession, verifySession, hashPassword, verifyPassword } from '@/lib/auth';

describe('tiptap extractText', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'heading', content: [{ type: 'text', text: 'Onboarding' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Welcome to the team.' }] },
    ],
  };
  it('flattens a ProseMirror doc to text', () => {
    expect(extractText(doc)).toBe('Onboarding Welcome to the team.');
  });
  it('previews with an ellipsis', () => {
    expect(previewText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(200) }] }] }, 10)).toHaveLength(11);
  });
  it('handles empty/garbage input', () => {
    expect(extractText(null)).toBe('');
    expect(extractText({})).toBe('');
  });
});

describe('page tree', () => {
  const pages: FlatPage[] = [
    { id: 'b', parentId: 'a', title: 'Child', slug: 'child', position: 1 },
    { id: 'a', parentId: null, title: 'Root', slug: 'root', position: 0 },
    { id: 'c', parentId: 'a', title: 'Another', slug: 'another', position: 0 },
  ];
  it('nests and sorts by position then title', () => {
    const tree = buildPageTree(pages);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('a');
    expect(tree[0].children.map((c) => c.id)).toEqual(['c', 'b']); // position 0 then 1
  });
  it('lists descendants', () => {
    const tree = buildPageTree(pages);
    expect(descendantIds(tree[0]).sort()).toEqual(['b', 'c']);
  });
});

describe('rbac', () => {
  it('grants and denies by role', () => {
    expect(can('viewer', 'page.read')).toBe(true);
    expect(can('viewer', 'page.write')).toBe(false);
    expect(can('editor', 'page.write')).toBe(true);
    expect(can('editor', 'workspace.manage')).toBe(false);
    expect(can('owner', 'workspace.manage')).toBe(true);
  });
  it('authorize throws ForbiddenError', () => {
    expect(() => authorize('viewer', 'page.write')).toThrow(ForbiddenError);
    expect(() => authorize('admin', 'page.write')).not.toThrow();
  });
});

describe('slug', () => {
  it('slugifies unicode (keeps cyrillic)', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
    expect(slugify('  База Знаний  ')).toBe('база-знаний');
    expect(slugify('***')).toBe('untitled');
  });
  it('deduplicates against taken slugs', () => {
    expect(uniqueSlug('Guide', ['guide'])).toBe('guide-2');
    expect(uniqueSlug('Guide', ['guide', 'guide-2'])).toBe('guide-3');
    expect(uniqueSlug('Fresh', ['guide'])).toBe('fresh');
  });
});

describe('auth sessions', () => {
  const secret = 'unit-test-secret';
  it('round-trips a signed session', () => {
    const token = signSession({ userId: 'u1', orgId: 'o1' }, secret);
    expect(verifySession(token, secret)).toMatchObject({ userId: 'u1', orgId: 'o1' });
  });
  it('rejects tampering and wrong secret', () => {
    const token = signSession({ userId: 'u1', orgId: 'o1' }, secret);
    expect(verifySession(token + 'x', secret)).toBeNull();
    expect(verifySession(token, 'other-secret')).toBeNull();
  });
  it('rejects expired tokens', () => {
    const token = signSession({ userId: 'u1', orgId: 'o1' }, secret, -1);
    expect(verifySession(token, secret)).toBeNull();
  });
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
