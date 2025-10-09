/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\.ts?$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\.ts?$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  modulePaths: ['<rootDir>/node_modules'],
};
