import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    // Boot NestJS + request HTTP butuh waktu lebih longgar dari unit test.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
})
