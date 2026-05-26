const { buildConfig, defaults } = require('../src/config');

describe('buildConfig', () => {
  test('returns defaults when called with no arguments', () => {
    const config = buildConfig();
    expect(config).toEqual(defaults);
  });

  test('merges overrides with defaults', () => {
    const config = buildConfig({ timeout: 1000, retries: 5 });
    expect(config.timeout).toBe(1000);
    expect(config.retries).toBe(5);
    expect(config.baseUrl).toBe(defaults.baseUrl);
  });

  test('does not mutate defaults object', () => {
    buildConfig({ timeout: 999 });
    expect(defaults.timeout).toBe(5000);
  });
});
