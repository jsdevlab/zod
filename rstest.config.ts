import { withRslibConfig } from '@rstest/adapter-rslib';
import { defineConfig } from '@rstest/core';

export default defineConfig({
  extends: withRslibConfig(),
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
