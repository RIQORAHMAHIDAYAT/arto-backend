import { describe, expect, it } from 'vitest'
import {
  budgetDisciplineScore,
  clamp,
  expenseStabilityScore,
  goalProgressScore,
  savingRateScore,
  scoreLabel,
  totalHealthScore,
} from './score'

describe('financial-health score', () => {
  it('clamp bounds a value', () => {
    expect(clamp(-5)).toBe(0)
    expect(clamp(150)).toBe(100)
    expect(clamp(42)).toBe(42)
  })

  it('savingRateScore rewards 20%+ saving rate and punishes overspending', () => {
    expect(savingRateScore(1_000_000, 700_000)).toBe(100) // 30% saved
    expect(savingRateScore(1_000_000, 200_000)).toBe(100) // 80% saved
    expect(savingRateScore(1_000_000, 800_000)).toBe(100) // 20% saved
    expect(savingRateScore(1_000_000, 900_000)).toBe(75) // 10% saved
    expect(savingRateScore(1_000_000, 1_100_000)).toBeLessThan(50) // overspent
    expect(savingRateScore(0, 100_000)).toBe(50) // no income
  })

  it('budgetDisciplineScore rewards low utilization and is neutral without budgets', () => {
    expect(budgetDisciplineScore([])).toBe(50)
    expect(budgetDisciplineScore([0.2, 0.5])).toBe(100)
    expect(budgetDisciplineScore([0.9])).toBeLessThan(100)
    expect(budgetDisciplineScore([1.5, 2])).toBeLessThan(50)
  })

  it('expenseStabilityScore rewards stable spending and neutral if too few days', () => {
    expect(expenseStabilityScore([])).toBe(50)
    expect(expenseStabilityScore([100, 100, 100])).toBe(100)
    const unstable = expenseStabilityScore([100, 50_000, 20])
    expect(unstable).toBeLessThan(100)
  })

  it('goalProgressScore reflects average progress of active goals', () => {
    expect(goalProgressScore([])).toBe(70)
    expect(goalProgressScore([0.5])).toBe(50)
    expect(goalProgressScore([0.9, 0.7])).toBe(80)
    // goals yang sudah tercapai tidak ditarik ke bawah
    expect(goalProgressScore([1, 1, 0.8])).toBe(80)
  })

  it('scoreLabel returns expected level', () => {
    expect(scoreLabel(80)).toBe('baik')
    expect(scoreLabel(60)).toBe('cukup')
    expect(scoreLabel(40)).toBe('perlu-pemantauan')
  })

  it('totalHealthScore applies configured weights', () => {
    const factors = [
      { key: 'savingRate' as const, score: 100 },
      { key: 'budgetDiscipline' as const, score: 50 },
      { key: 'expenseStability' as const, score: 100 },
      { key: 'goalProgress' as const, score: 50 },
    ]
    expect(totalHealthScore(factors)).toBe(80) // 100*0.4 + 50*0.25 + 100*0.2 + 50*0.15
  })
})