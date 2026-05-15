import type { Config } from 'jest';

const sharedTransform = {
  '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.test.json' }],
};

const config: Config = {
  rootDir: 'src',
  // Top-level transform enables ts-jest for globalSetup/globalTeardown files
  transform: sharedTransform,
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.integration.spec.ts',
    '!**/migrations/**',
    '!**/main.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['lcov', 'text-summary'],
  projects: [
    {
      displayName: 'unit',
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: 'src',
      testRegex: '.*\\.spec\\.ts$',
      testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$', '/migrations/'],
      transform: sharedTransform,
      testEnvironment: 'node',
    },
    {
      displayName: 'integration',
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: 'src',
      testRegex: '.*\\.integration\\.spec\\.ts$',
      testPathIgnorePatterns: ['/migrations/'],
      transform: sharedTransform,
      testEnvironment: 'node',
      testTimeout: 60000,
      // Single PostgreSQL container shared across all integration test files
      globalSetup: '<rootDir>/test/integration-global-setup.ts',
      globalTeardown: '<rootDir>/test/integration-global-teardown.ts',
    },
  ],
};

export default config;
