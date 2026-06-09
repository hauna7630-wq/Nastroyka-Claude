/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Integration tests require live Postgres + Redis; run them via
  // `npm run test:integration` (jest.integration.config.js) instead.
  testPathIgnorePatterns: ['/node_modules/', '/integration/'],
  clearMocks: true,
};
