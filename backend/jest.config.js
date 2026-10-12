/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '(apps|libs)/.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: true }] },
  moduleNameMapper: {
    '^@app/common$': '<rootDir>/libs/common/src',
    '^@app/mongo$': '<rootDir>/libs/mongo/src',
    '^@app/redis$': '<rootDir>/libs/redis/src',
    '^@app/messaging$': '<rootDir>/libs/messaging/src',
  },
  collectCoverageFrom: ['{apps,libs}/**/src/**/*.ts', '!**/main.ts', '!**/index.ts', '!**/*.spec.ts'],
};
