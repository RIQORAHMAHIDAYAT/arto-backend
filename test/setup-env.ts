/**
 * Berjalan SEBELUM modul aplikasi diimpor oleh file test.
 * Memastikan proses e2e selalu mengarah ke database UJI, bukan database dev,
 * meskipun ConfigModule tetap membaca file .env (process.env menang).
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test'
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://arto:arto_secret@localhost:5432/arto_test'

// Fallback secret agar boot tetap valid walau .env tidak tersedia di CI.
if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
  process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-panjang-untuk-lingkungan-uji-lokal'
}
