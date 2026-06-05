/** @type {import('ts-jest').JestConfigWithTsJest} */
// Integration tests: real Postgres (PrismaRepository) + real Redis (BullMQQueue).
// Requires DATABASE_URL and REDIS_URL; see docker-compose.yml for local infra.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.int.test.ts'],
  testTimeout: 30000,
  clearMocks: true,
  // BullMQ/ioredis can keep handles briefly after close; don't hang the runner.
  forceExit: true,
};
