import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: { autoExtension: true },
    },
    {
      format: 'cjs',
      syntax: 'es2022',
      dts: { autoExtension: true },
    },
  ],
  // Universal output: usable from Node.js and bundled for modern browsers.
  output: {
    target: 'web',
  },
  source: {
    entry: {
      index: ['./src/index.ts'],
    },
    tsconfigPath: './tsconfig.build.json',
  },
});
