import { describe, expect, it } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'
import { toNumber } from './money'

describe('money utils', () => {
  it('toNumber normalizes Prisma Decimal', () => {
    expect(toNumber(new Decimal('12345.67'))).toBe(12345.67)
  })

  it('toNumber handles number, string, null and undefined', () => {
    expect(toNumber(42)).toBe(42)
    expect(toNumber('99.5')).toBe(99.5)
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
  })
})