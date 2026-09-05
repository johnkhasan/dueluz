import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./src', import.meta.url));
const alias = { '@': root };

export default defineConfig({
  resolve: { alias },
  test: {
    // Integration tests share one database and TRUNCATE between files, so test
    // files must not run concurrently.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./tests/setup-env.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./tests/setup-env.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
