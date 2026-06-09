import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.spec.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      reportsDirectory: './coverage',
      include: ['lib/**', 'app/**', 'components/**'],
      exclude: ['**/*.spec.*', '**/node_modules/**', '**/.next/**'],
    },
  },
  resolve: {
    alias: {
      // next/font/google calls the font-loading infra at module-eval time — always swap it out
      'next/font/google': path.resolve(__dirname, '__mocks__/next-font-google.ts'),
    },
  },
});
