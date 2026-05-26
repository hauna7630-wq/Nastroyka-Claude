const defaults = {
  timeout: 5000,
  retries: 3,
  baseUrl: 'https://api.example.com',
  pageSize: 20,
};

function buildConfig(overrides = {}) {
  return { ...defaults, ...overrides };
}

module.exports = { buildConfig, defaults };
