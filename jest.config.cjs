module.exports = {
  projects: [
    {
      displayName: 'core',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/core/**/*.test.ts', '<rootDir>/tests/server/**/*.test.ts'],
      transform: { '\\.[jt]s$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
    },
    {
      displayName: 'mobile',
      preset: 'jest-expo/ios',
      testMatch: ['<rootDir>/tests/mobile/**/*.test.tsx'],
    },
  ],
  collectCoverageFrom: [
    'shared/**/*.ts',
    'src/features/**/application/**/*.ts',
    'src/features/**/data/clientRepository.ts',
    'server/repository.ts',
    'server/http.ts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: { global: { lines: 90, statements: 90, functions: 90, branches: 85 } },
};
