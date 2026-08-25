import { describe, expect, it } from 'vitest'
import { validateEnv } from './env.validation'

describe('validateEnv', () => {
  it('mengizinkan environment development tanpa secret kuat', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow()
  })

  it('mengizinkan environment test tanpa secret kuat', () => {
    expect(() => validateEnv({ NODE_ENV: 'test' })).not.toThrow()
  })

  it('melempar error di production jika DATABASE_URL kosong', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'a'.repeat(40) }),
    ).toThrow(/DATABASE_URL/)
  })

  it('melempar error di production jika JWT_ACCESS_SECRET kosong', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgres://localhost/arto' }),
    ).toThrow(/JWT_ACCESS_SECRET/)
  })

  it('melempar error di production jika JWT_ACCESS_SECRET terlalu pendek', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://localhost/arto',
        JWT_ACCESS_SECRET: 'short',
      }),
    ).toThrow(/minimal 32 karakter/)
  })

  it('melempar error di production jika JWT_ACCESS_SECRET menggunakan placeholder dev-only atau change-in-production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://localhost/arto',
        JWT_ACCESS_SECRET: 'dev-only-access-secret-change-in-production',
      }),
    ).toThrow(/placeholder/)
  })

  it('lolos di production dengan konfigurasi lengkap dan secret kuat', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://localhost/arto',
      JWT_ACCESS_SECRET: 'a-very-long-secret-value-with-more-than-32-chars!',
    })
    expect(result.NODE_ENV).toBe('production')
  })
})