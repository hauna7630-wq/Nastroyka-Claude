/** @type {import('ts-jest').JestConfigWithTsJest} */
// DB integration tests: real Postgres via Prisma. Gated on DATABASE_URL.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.int.test.ts'],
  testTimeout: 30000,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  forceExit: true,
  clearMocks: true,
};
