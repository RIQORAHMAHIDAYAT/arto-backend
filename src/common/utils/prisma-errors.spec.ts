import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { isExclusionViolation, isForeignKeyViolation } from './prisma-errors'

function knownError(code: string, message = 'db error'): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: 'test' })
}

describe('isForeignKeyViolation', () => {
  it('mengenali P2003 sebagai pelanggaran FK', () => {
    expect(isForeignKeyViolation(knownError('P2003'))).toBe(true)
  })

  it('tidak mengenali kode lain', () => {
    expect(isForeignKeyViolation(knownError('P2002'))).toBe(false)
    expect(isForeignKeyViolation(new Error('biasa'))).toBe(false)
    expect(isForeignKeyViolation(null)).toBe(false)
  })
})

describe('isExclusionViolation', () => {
  it('mengenali P2004 sebagai constraint generik', () => {
    expect(isExclusionViolation(knownError('P2004'))).toBe(true)
  })

  it('mengenali pesan berisi kode 23P01 pada known request error', () => {
    const err = knownError('XXXXX', 'error: conflicting key value violates exclusion constraint "budgets_no_overlap" (23P01)')
    expect(isExclusionViolation(err)).toBe(true)
  })

  it('mengenali unknown request error dengan kata exclusion/23P01', () => {
    const err = new Prisma.PrismaClientUnknownRequestError(
      'violates exclusion constraint detail (23P01)',
      { clientVersion: 'test' },
    )
    expect(isExclusionViolation(err)).toBe(true)
  })

  it('menolak error yang tidak relevan', () => {
    expect(isExclusionViolation(knownError('P2002'))).toBe(false)
    expect(isExclusionViolation(new Prisma.PrismaClientUnknownRequestError('koneksi gagal', { clientVersion: 'test' }))).toBe(false)
    expect(isExclusionViolation(undefined)).toBe(false)
  })
})
