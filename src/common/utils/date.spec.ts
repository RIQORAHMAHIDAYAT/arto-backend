import { describe, expect, it } from 'vitest'
import {
  addDaysUtc,
  daysBetweenInclusive,
  isDateOnly,
  parseDateOnly,
  parseEndOfDay,
  startOfDayUtc,
  toDateOnly,
} from './date'

describe('date utils', () => {
  it('parseDateOnly parses YYYY-MM-DD as UTC midnight', () => {
    const d = parseDateOnly('2026-08-20')
    expect(d.toISOString()).toBe('2026-08-20T00:00:00.000Z')
  })

  it('parseDateOnly produces invalid Date for non-calendar dates', () => {
    expect(Number.isNaN(parseDateOnly('2026-13-01').getTime())).toBe(true)
    expect(Number.isNaN(parseDateOnly('2026-08-32').getTime())).toBe(true)
  })

  it('toDateOnly extracts the date part in UTC', () => {
    expect(toDateOnly(new Date('2026-08-20T15:30:00.000Z'))).toBe('2026-08-20')
  })

  it('parseEndOfDay sets 23:59:59.999', () => {
    expect(parseEndOfDay('2026-08-20').toISOString()).toBe('2026-08-20T23:59:59.999Z')
  })

  it('startOfDayUtc zeroes the time', () => {
    const d = startOfDayUtc(new Date('2026-08-20T15:30:00.000Z'))
    expect(d.toISOString()).toBe('2026-08-20T00:00:00.000Z')
  })

  it('addDaysUtc handles month boundaries', () => {
    expect(toDateOnly(addDaysUtc(parseDateOnly('2026-08-31'), 1))).toBe('2026-09-01')
    expect(toDateOnly(addDaysUtc(parseDateOnly('2026-03-01'), -1))).toBe('2026-02-28')
  })

  it('daysBetweenInclusive counts both endpoints', () => {
    expect(daysBetweenInclusive(parseDateOnly('2026-08-01'), parseDateOnly('2026-08-20'))).toBe(20)
    expect(daysBetweenInclusive(parseDateOnly('2026-08-20'), parseDateOnly('2026-08-01'))).toBe(1)
  })

  it('isDateOnly matches strict YYYY-MM-DD', () => {
    expect(isDateOnly('2026-08-20')).toBe(true)
    expect(isDateOnly('2026-8-20')).toBe(false)
    expect(isDateOnly('20-08-2026')).toBe(false)
    expect(isDateOnly('2026-13-99')).toBe(true) // regex only; calendar validation dilakukan via parse
  })
})