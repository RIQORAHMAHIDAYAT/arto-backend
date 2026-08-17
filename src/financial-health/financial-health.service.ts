import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { toNumber } from '../common/utils/money'
import { addDaysUtc, parseDateOnly, parseEndOfDay, toDateOnly } from '../common/utils/date'

export interface FinancialHealthFactor {
  key: 'savingRate' | 'budgetDiscipline' | 'expenseStability' | 'goalProgress'
  label: string
  description: string
  score: number
  detail: string
}

export interface FinancialHealthReport {
  score: number
  level: 'baik' | 'cukup' | 'perlu-pemantauan'
  summary: string
  factors: FinancialHealthFactor[]
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value))

function savingRateScore(income: number, expense: number): number {
  if (income <= 0) return 50
  const rate = (income - expense) / income
  if (rate >= 0.2) return 100
  if (rate >= 0) return clamp(50 + (rate / 0.2) * 50)
  return clamp(50 + rate * 50)
}

function budgetDisciplineScore(utilizations: number[]): number {
  if (utilizations.length === 0) return 50
  const avg = utilizations.reduce((sum, u) => sum + clamp(u, 0, 1), 0) / utilizations.length
  if (avg <= 0.8) return 100
  if (avg <= 1) return clamp(100 - ((avg - 0.8) / 0.2) * 70)
  return clamp((1 / avg) * 40)
}

function expenseStabilityScore(dailyExpenses: number[]): number {
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

function goalProgressScore(progresses: number[]): number {
  const active = progresses.filter((p) => p < 1)
  if (active.length === 0) return 70
  const avg = active.reduce((a, b) => a + b, 0) / active.length
  return clamp(avg * 100)
}

function scoreLabel(score: number): 'baik' | 'cukup' | 'perlu-pemantauan' {
  if (score >= 75) return 'baik'
  if (score >= 50) return 'cukup'
  return 'perlu-pemantauan'
}

interface RawInput {
  income: number
  expense: number
  budgetUtilizations: number[]
  goalProgresses: number[]
  dailyExpenses: number[]
}

@Injectable()
export class FinancialHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(userId: string, today = new Date()): Promise<FinancialHealthReport> {
    const from = toDateOnly(addDaysUtc(today, -28))
    const to = toDateOnly(today)
    const monthStart = toDateOnly(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)))
    const monthEnd = toDateOnly(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)))

    const raw = await this.collectRaw(userId, from, to, monthStart, monthEnd)
    return this.buildReport(raw)
  }

  private async collectRaw(
    userId: string,
    from: string,
    to: string,
    monthStart: string,
    monthEnd: string,
  ): Promise<RawInput> {
    const [grouped, budgets, goals, dailyTransactions] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { userId, transactionDate: { gte: parseDateOnly(monthStart), lte: parseEndOfDay(monthEnd) } },
        _sum: { amount: true },
      }),
      this.prisma.budget.findMany({ where: { userId } }),
      this.prisma.financialGoal.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({
        where: { userId, type: 'expense', transactionDate: { gte: parseDateOnly(from), lte: parseEndOfDay(to) } },
        select: { transactionDate: true, amount: true, categoryId: true },
      }),
    ])

    const incomeRecord = grouped.find((g) => g.type === 'income')
    const expenseRecord = grouped.find((g) => g.type === 'expense')
    const income = toNumber(incomeRecord?._sum.amount)
    const expense = toNumber(expenseRecord?._sum.amount)

    const activeBudgets = budgets.filter((b) => b.periodStart <= parseDateOnly(monthEnd) && b.periodEnd >= parseDateOnly(monthStart))
    const budgetUtilizations: number[] = []
    for (const b of activeBudgets) {
      const spent = await this.spentForBudget(userId, b.categoryId, b.periodStart, b.periodEnd)
      const amount = toNumber(b.amount)
      budgetUtilizations.push(amount > 0 ? spent / amount : 0)
    }

    const goalProgresses = goals.map((g) => (toNumber(g.targetAmount) > 0 ? toNumber(g.currentAmount) / toNumber(g.targetAmount) : 0))

    const dailyMap = new Map<string, number>()
    for (const t of dailyTransactions) dailyMap.set(toDateOnly(t.transactionDate), (dailyMap.get(toDateOnly(t.transactionDate)) ?? 0) + toNumber(t.amount))
    const dailyExpenses = this.buildDailySeries(dailyMap, 29, parseDateOnly(to))

    return { income, expense, budgetUtilizations, goalProgresses, dailyExpenses }
  }

  private async spentForBudget(userId: string, categoryId: string, start: Date, end: Date): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: { userId, categoryId, type: 'expense', transactionDate: { gte: start, lte: end } },
      _sum: { amount: true },
    })
    return toNumber(result._sum.amount)
  }

  private buildDailySeries(map: Map<string, number>, days: number, end: Date): number[] {
    const series: number[] = []
    for (let i = days - 1; i >= 0; i -= 1) {
      const key = toDateOnly(addDaysUtc(end, -i))
      series.push(map.get(key) ?? 0)
    }
    return series
  }

  private buildReport(raw: RawInput): FinancialHealthReport {
    const factors: FinancialHealthFactor[] = [
      {
        key: 'savingRate',
        label: 'Saving Rate',
        description: 'Porsi pemasukan yang tidak terpakai sebagai pengeluaran.',
        score: savingRateScore(raw.income, raw.expense),
        detail:
          raw.income <= 0
            ? 'Belum ada pemasukan bulan ini.'
            : `Memakai ${Math.round((raw.expense / raw.income) * 100)}% dari pemasukan.`,
      },
      {
        key: 'budgetDiscipline',
        label: 'Disiplin Budget',
        description: 'Seberapa dekat pengeluaran dengan batas budget.',
        score: budgetDisciplineScore(raw.budgetUtilizations),
        detail:
          raw.budgetUtilizations.length === 0
            ? 'Belum ada budget aktif.'
            : `${raw.budgetUtilizations.length} budget aktif tercatat.`,
      },
      {
        key: 'expenseStability',
        label: 'Stabilitas Pengeluaran',
        description: 'Seberapa stabil pengeluaran harianmu.',
        score: expenseStabilityScore(raw.dailyExpenses),
        detail: 'Dihitung dari variasi pengeluaran harian.',
      },
      {
        key: 'goalProgress',
        label: 'Progres Goals',
        description: 'Seberapa dekat kamu dengan tujuan finansial.',
        score: goalProgressScore(raw.goalProgresses),
        detail:
          raw.goalProgresses.length === 0
            ? 'Belum ada financial goal.'
            : `${raw.goalProgresses.filter((p) => p < 1).length} goal aktif sedang berjalan.`,
      },
    ]

    const weights: Record<FinancialHealthFactor['key'], number> = {
      savingRate: 0.4,
      budgetDiscipline: 0.25,
      expenseStability: 0.2,
      goalProgress: 0.15,
    }

    const score = Math.round(factors.reduce((sum, f) => sum + f.score * weights[f.key], 0))
    const level = scoreLabel(score)

    const summary: Record<typeof level, string> = {
      baik: 'Kondisi keuanganmu terlihat sehat. Pertahankan kebiasaan menabung dan disiplin budget.',
      cukup: 'Kondisi keuanganmu cukup baik, tapi masih ada ruang untuk ditingkatkan.',
      'perlu-pemantauan': 'Kondisi keuanganmu butuh perhatian. Periksa faktor di bawah dan coba kecilkan pengeluaran.',
    }

    return { score, level, summary: summary[level], factors }
  }
}