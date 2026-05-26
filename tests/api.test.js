const { getUser, clearCache, paginate } = require('../src/api');

beforeEach(() => {
  clearCache();
});

describe('getUser', () => {
  test('returns a user object with correct id', async () => {
    const user = await getUser(1);
    expect(user.id).toBe(1);
    expect(user.name).toBe('User_1');
  });

  test('caches result on second call', async () => {
    const first = await getUser(42);
    const second = await getUser(42);
    expect(first).toBe(second);
  });

  test('returns different users for different ids', async () => {
    const [a, b] = await Promise.all([getUser(10), getUser(20)]);
    expect(a.id).toBe(10);
    expect(b.id).toBe(20);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  test('returns correct page slice', () => {
    expect(paginate(items, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(paginate(items, 2, 10)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  test('handles last page with fewer items', () => {
    expect(paginate(items, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  test('returns empty array for out-of-range page', () => {
    expect(paginate(items, 10, 10)).toEqual([]);
  });
});
