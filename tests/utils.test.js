const { formatDate, sum, sortByField, debounce } = require('../src/utils');

describe('formatDate', () => {
  test('formats a date correctly', () => {
    const d = new Date('2024-03-15T12:00:00Z');
    expect(formatDate(d)).toBe('2024-03-15');
  });
});

describe('sum', () => {
  test('adds two positive numbers', () => {
    expect(sum(2, 3)).toBe(5);
  });

  test('handles negative numbers', () => {
    expect(sum(-1, 1)).toBe(0);
  });
});

describe('sortByField', () => {
  test('sorts array by string field', () => {
    const input = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];
    const result = sortByField(input, 'name');
    expect(result.map((x) => x.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  test('does not mutate original array', () => {
    const input = [{ v: 3 }, { v: 1 }, { v: 2 }];
    sortByField(input, 'v');
    expect(input[0].v).toBe(3);
  });
});

describe('debounce', () => {
  jest.useFakeTimers();

  test('calls function after delay', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('only calls once when invoked multiple times rapidly', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);
    debounced();
    debounced();
    debounced();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
