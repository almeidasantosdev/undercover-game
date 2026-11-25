/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: ['src/App.tsx', 'src/gameDisplay.ts'],
  coverageReporters: ['text', 'text-summary'],
};
