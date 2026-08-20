/**
 * Aturan penilaian Financial Health — murni (pure functions) agar mudah diuji.
 * Backend adalah satu-satunya sumber kebenaran untuk aturan ini.
 */

export const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value))

export function savingRateScore(income: number, expense: number): number {
  if (income <= 0) return 50
  const rate = (income - expense) / income
  if (rate >= 0.2) return 100
  if (rate >= 0) return clamp(50 + (rate / 0.2) * 50)
  return clamp(50 + rate * 50)
}

export function budgetDisciplineScore(utilizations: number[]): number {
  if (utilizations.length === 0) return 50
  const avg = utilizations.reduce((sum, u) => sum + clamp(u, 0, 1), 0) / utilizations.length
  if (avg <= 0.8) return 100
  if (avg <= 1) return clamp(100 - ((avg - 0.8) / 0.2) * 70)
  return clamp((1 / avg) * 40)
}

export function expenseStabilityScore(dailyExpenses: number[]): number {
  const values = dailyExpenses.filter((d) => d > 0)
  if (values.length < 3) return 50
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean <= 0) return 50
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  const cv = Math.sqrt(variance) / mean
  if (cv <= 0.4) return 100
  if (cv <= 1) return clamp(100 - ((cv - 0.4) / 0.6) * 50)
  return clamp(50 - (cv - 1) * 30)
}

export function goalProgressScore(progresses: number[]): number {
  const active = progresses.filter((p) => p < 1)
  if (active.length === 0) return 70
  const avg = active.reduce((a, b) => a + b, 0) / active.length
  return clamp(avg * 100)
}

export function scoreLabel(score: number): 'baik' | 'cukup' | 'perlu-pemantauan' {
  if (score >= 75) return 'baik'
  if (score >= 50) return 'cukup'
  return 'perlu-pemantauan'
}

export const HEALTH_WEIGHTS = {
  savingRate: 0.4,
  budgetDiscipline: 0.25,
  expenseStability: 0.2,
  goalProgress: 0.15,
} as const

export function totalHealthScore(factors: Array<{ key: keyof typeof HEALTH_WEIGHTS; score: number }>): number {
  return Math.round(
    factors.reduce((sum, f) => sum + f.score * HEALTH_WEIGHTS[f.key], 0),
  )
}