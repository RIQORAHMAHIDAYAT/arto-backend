import { execSync, type ExecSyncOptions } from 'node:child_process'

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgresql://arto:arto_secret@localhost:5432/arto_test'
// Database maintenance bawaan untuk membuat arto_test jika belum ada.
const MAINTENANCE_DB_URL = TEST_DB_URL.replace(/\/[^/]+$/, '/postgres')

function run(command: string, options: ExecSyncOptions = {}): void {
  execSync(command, { stdio: 'inherit', ...options })
}

/**
 * Menyiapkan database uji:
 * 1. CREATE DATABASE arto_test (diabaikan bila sudah ada)
 * 2. prisma migrate deploy — termasuk constraint budgets_no_overlap
 */
export default function globalSetup(): void {
  try {
    run(`npx prisma db execute --url "${MAINTENANCE_DB_URL}" --stdin`, {
      input: 'CREATE DATABASE arto_test OWNER arto;',
    })
    console.log('[e2e] Database uji arto_test dibuat.')
  } catch {
    console.log('[e2e] Database uji arto_test sudah ada — lanjut.')
  }

  try {
    run('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_DB_URL } })
  } catch (err) {
    console.error(
      '[e2e] Gagal menjalankan migrasi terhadap database uji.\n' +
        '      Pastikan PostgreSQL dev berjalan: powershell -ExecutionPolicy Bypass -File scripts/dev-postgres.ps1\n',
    )
    throw err
  }
}
