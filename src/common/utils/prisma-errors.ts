import { Prisma } from '@prisma/client'

/**
 * Helper deteksi error database Prisma agar service bisa menerjemahkan
 * pelanggaran constraint menjadi respons HTTP yang ramah tanpa menyerahkan
 * detail teknis ke klien.
 */

/** Pelanggaran foreign key (PostgreSQL 23503) — data masih dirujuk entitas lain. */
export function isForeignKeyViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003'
}

/**
 * Pelanggaran constraint eksklusif PostgreSQL (23P01), dipakai oleh
 * constraint `budgets_no_overlap` pada tabel budgets. Ketergantungan versi:
 * Prisma dapat melaporkannya sebagai P2004 (constraint generik) atau sebagai
 * unknown request error dengan pesan asli dari database, jadi keduanya dicek.
 */
export function isExclusionViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2004' || err.message.includes('23P01')
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return err.message.includes('23P01') || err.message.includes('exclusion')
  }
  return false
}
