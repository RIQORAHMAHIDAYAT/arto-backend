import { parseDateOnly, startOfDayUtc } from '../common/utils/date'

export interface DailyLimitParams {
  budgetAmount: number
  spent: number
  today: Date
  periodEnd: Date
}

export interface DailyLimitResult {
  remainingBudget: number
  remainingDays: number
  dailyLimit: number
}

export function remainingBudget(budgetAmount: number, spent: number): number {
  return Math.max(0, budgetAmount - spent)
}

export function remainingDays(today: Date, periodEnd: Date): number {
  const todayStart = startOfDayUtc(today)
  const endStart = startOfDayUtc(periodEnd)
  const diff = Math.round((endStart.getTime() - todayStart.getTime()) / 86_400_000)
  return Math.max(0, diff + 1)
}

export function calculateDailyLimit({ budgetAmount, spent, today, periodEnd }: DailyLimitParams): DailyLimitResult {
  const budget = remainingBudget(budgetAmount, spent)
  const days = remainingDays(today, periodEnd)
  const limit = days <= 0 || budget <= 0 ? 0 : Math.floor(budget / days)
  return { remainingBudget: budget, remainingDays: days, dailyLimit: limit }
}

export function remainingToday(spentToday: number, dailyLimit: number): number {
  return Math.max(0, dailyLimit - spentToday)
}

export function budgetUtilization(spent: number, amount: number): number {
  if (amount <= 0) return spent > 0 ? 1 : 0
  return spent / amount
}

export function parsePeriodEnd(value: string): Date {
  const d = parseDateOnly(value)
  d.setUTCHours(23, 59, 59, 999)
  return d
}