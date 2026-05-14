/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

const path = require('path');

/** @type {import('jest').Config} */
module.exports = {
  roots: ['<rootDir>/test'],
  testMatch: ['**/Ssr*.test.ts'],
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.(js|ts)$': 'babel-jest',
  },
  moduleDirectories: ['node_modules', 'src'],
  testEnvironment: 'jsdom',
  reporters: [
    'default',
    [path.resolve(__dirname, 'node_modules', 'jest-junit', 'index.js'), {
      outputDirectory: path.resolve(__dirname, 'artifacts', 'log'),
      outputName: `${process.platform}.components-webjs.junit.xml`,
    }],
  ],
};
