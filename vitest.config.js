import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'tests/local/**/*.{test,spec}.{js,ts}'
    ],
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
    }
  }
});