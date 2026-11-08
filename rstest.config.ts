import { withRslibConfig } from '@rstest/adapter-rslib';
import { defineConfig, defineInlineProject } from '@rstest/core';

const include = ['src/**/*.test.ts'];

export default defineConfig({
  extends: withRslibConfig(),
  projects: [
    defineInlineProject({
      name: 'node',
      include,
      exclude: ['src/**/browser.test.ts'],
      testEnvironment: 'node',
    }),
    defineInlineProject({
      name: 'browser',
      include,
      testEnvironment: 'happy-dom',
    }),
  ],
  coverage: {
    provider: 'v8',
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/**/__tests__/**', 'src/**/*.test.*'],
    reporters: ['text'],
    thresholds: {
      statements: 85,
      branches: 70,
      functions: 90,
      lines: 85,
    },
  },
});
