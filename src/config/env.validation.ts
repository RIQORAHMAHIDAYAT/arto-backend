/**
 * Validasi environment variable di entry-point (ConfigModule).
 *
 * Prinsip keamanan: pada environment production, ARTO harus gagal dengan cepat
 * (fail-fast) jika konfigurasi kritis tidak diset atau masih bernilai default.
 * Jangan pernah membiarkan server jalan dengan JWT secret lemah/placeholder.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  if (config.NODE_ENV !== 'production') return config

  const errors: string[] = []

  const databaseUrl = config.DATABASE_URL
  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    errors.push('DATABASE_URL wajib diisi pada environment production.')
  }

  const secret = typeof config.JWT_ACCESS_SECRET === 'string' ? config.JWT_ACCESS_SECRET : ''
  if (!secret) {
    errors.push('JWT_ACCESS_SECRET wajib diisi pada environment production.')
  } else if (secret.length < 32) {
    errors.push('JWT_ACCESS_SECRET minimal 32 karakter.')
  } else if (secret.startsWith('change-me-') || secret === 'dev-access-secret') {
    errors.push('JWT_ACCESS_SECRET masih bernilai placeholder — ganti dengan secret kuat.')
  }

  if (errors.length > 0) {
    throw new Error(`Validasi environment production gagal:\n- ${errors.join('\n- ')}`)
  }

  return config
}