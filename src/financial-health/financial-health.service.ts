import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { toNumber } from '../common/utils/money'
import { addDaysUtc, parseDateOnly, parseEndOfDay, toDateOnly } from '../common/utils/date'
import {
  budgetDisciplineScore,
  expenseStabilityScore,
  goalProgressScore,
  savingRateScore,
  scoreLabel,
  totalHealthScore,
} from './score'

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
    const spentList = await Promise.all(
      activeBudgets.map(async (b) => this.spentForBudget(userId, b.categoryId, b.periodStart, b.periodEnd)),
    )
    const budgetUtilizations = activeBudgets.map((b, i) => {
      const amount = toNumber(b.amount)
      return amount > 0 ? spentList[i] / amount : 0
    })

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

    const score = totalHealthScore(factors)
    const level = scoreLabel(score)

    const summary: Record<typeof level, string> = {
      baik: 'Kondisi keuanganmu terlihat sehat. Pertahankan kebiasaan menabung dan disiplin budget.',
      cukup: 'Kondisi keuanganmu cukup baik, tapi masih ada ruang untuk ditingkatkan.',
      'perlu-pemantauan': 'Kondisi keuanganmu butuh perhatian. Periksa faktor di bawah dan coba kecilkan pengeluaran.',
    }

    return { score, level, summary: summary[level], factors }
  }
}