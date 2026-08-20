import { describe, expect, it } from 'vitest'
import {
  budgetUtilization,
  calculateDailyLimit,
  parsePeriodEnd,
  remainingBudget,
  remainingDays,
  remainingToday,
} from './daily-limit.util'
import { parseDateOnly } from '../common/utils/date'

describe('daily-limit.util', () => {
  it('remainingBudget never goes below zero', () => {
    expect(remainingBudget(1_000_000, 400_000)).toBe(600_000)
    expect(remainingBudget(1_000_000, 1_500_000)).toBe(0)
  })

  it('remainingDays counts from today to period end inclusively', () => {
    expect(remainingDays(parseDateOnly('2026-08-20'), parseDateOnly('2026-08-25'))).toBe(6)
    expect(remainingDays(parseDateOnly('2026-08-20'), parseDateOnly('2026-08-19'))).toBe(0)
  })

  it('calculateDailyLimit floors daily budget across remaining days', () => {
    const result = calculateDailyLimit({
      budgetAmount: 1_000_000,
      spent: 400_000,
      today: parseDateOnly('2026-08-20'),
      periodEnd: parseDateOnly('2026-08-25'),
    })
    expect(result.remainingBudget).toBe(600_000)
    expect(result.remainingDays).toBe(6)
    expect(result.dailyLimit).toBe(100_000)
  })

  it('calculateDailyLimit returns zero when budget exhausted or period ended', () => {
    const exhausted = calculateDailyLimit({
      budgetAmount: 100_000,
      spent: 200_000,
      today: parseDateOnly('2026-08-20'),
      periodEnd: parseDateOnly('2026-08-25'),
    })
    expect(exhausted.dailyLimit).toBe(0)

    const ended = calculateDailyLimit({
      budgetAmount: 100_000,
      spent: 0,
      today: parseDateOnly('2026-08-26'),
      periodEnd: parseDateOnly('2026-08-25'),
    })
    expect(ended.dailyLimit).toBe(0)
  })

  it('remainingToday never goes below zero', () => {
    expect(remainingToday(30_000, 100_000)).toBe(70_000)
    expect(remainingToday(150_000, 100_000)).toBe(0)
  })

  it('budgetUtilization handles zero/negative budgets as fully blown', () => {
    expect(budgetUtilization(50_000, 100_000)).toBe(0.5)
    expect(budgetUtilization(10_000, 0)).toBe(1)
    expect(budgetUtilization(0, 0)).toBe(0)
  })

  it('parsePeriodEnd sets end-of-day boundary', () => {
    expect(parsePeriodEnd('2026-08-20').toISOString()).toBe('2026-08-20T23:59:59.999Z')
  })
})