import { Injectable } from '@nestjs/common'
import { AccountsService } from '../accounts/accounts.service'
import { BudgetsService, BudgetSummaryItem, DailyLimitInfo } from '../budgets/budgets.service'
import { PrismaService } from '../common/prisma/prisma.service'
import { TransactionType } from '@prisma/client'
import { addDaysUtc, daysBetweenInclusive, parseDateOnly, parseEndOfDay, toDateOnly } from '../common/utils/date'
import { toNumber } from '../common/utils/money'
import { transactionToResponse } from '../transactions/transactions.service'

export interface SpendingChartPoint {
  date: string
  income: number
  expense: number
}

export interface DashboardSummary {
  totalBalance: number
  totalInitialBalance: number
  totalIncome: number
  totalExpense: number
  periodLabel: string
  recentTransactions: ReturnType<typeof transactionToResponse>[]
  budgetSummary: BudgetSummaryItem[]
  dailyLimit: DailyLimitInfo | null
  spendingChart: SpendingChartPoint[]
}

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'] as const

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly budgetsService: BudgetsService,
  ) {}

  async getSummary(userId: string, today = new Date()): Promise<DashboardSummary> {
    const monthBounds = this.monthBounds(today)
    const [accounts, monthTotals, recentTransactions, budgetSummary, activeBudget] = await Promise.all([
      this.accountsService.list(userId),
      this.periodTotals(userId, monthBounds.start, monthBounds.end),
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.budgetsService.listSummary(userId),
      this.budgetsService.pickActiveBudget(userId, today),
    ])

    const spentByBudget = new Map(budgetSummary.map((b) => [b.budgetId, b.spent]))
    const dailyLimit = activeBudget
      ? await this.budgetsService.getDailyLimit(
          userId,
          activeBudget.id,
          today,
          spentByBudget.get(activeBudget.id),
        )
      : null

    return {
      totalBalance: accounts.reduce((sum, a) => sum + a.balance, 0),
      totalInitialBalance: accounts.reduce((sum, a) => sum + a.initialBalance, 0),
      totalIncome: monthTotals.income,
      totalExpense: monthTotals.expense,
      periodLabel: this.periodLabel(today),
      recentTransactions: recentTransactions.map(transactionToResponse),
      budgetSummary,
      dailyLimit,
      spendingChart: await this.buildSpendingChart(userId, today),
    }
  }

  private monthBounds(today: Date): { start: string; end: string } {
    const y = today.getUTCFullYear()
    const m = today.getUTCMonth()
    const start = toDateOnly(new Date(Date.UTC(y, m, 1)))
    const endDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const end = toDateOnly(new Date(Date.UTC(y, m, endDay)))
    return { start, end }
  }

  private periodLabel(today: Date): string {
    return `${MONTHS_ID[today.getUTCMonth()]} ${today.getUTCFullYear()}`
  }

  private async periodTotals(
    userId: string,
    start: string,
    end: string,
  ): Promise<{ income: number; expense: number }> {
    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        userId,
        transactionDate: { gte: parseDateOnly(start), lte: parseEndOfDay(end) },
      },
      _sum: { amount: true },
    })
    const byType = new Map(grouped.map((g) => [g.type, toNumber(g._sum.amount)]))
    return {
      income: byType.get(TransactionType.income) ?? 0,
      expense: byType.get(TransactionType.expense) ?? 0,
    }
  }

  private async buildSpendingChart(userId: string, today: Date): Promise<SpendingChartPoint[]> {
    const from = addDaysUtc(today, -6)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        transactionDate: { gte: parseDateOnly(toDateOnly(from)), lte: parseEndOfDay(toDateOnly(today)) },
      },
      select: { transactionDate: true, type: true, amount: true },
    })

    const days = daysBetweenInclusive(from, today)
    const buckets = new Map<string, SpendingChartPoint>()
    for (let i = 0; i < days; i += 1) {
      const key = toDateOnly(addDaysUtc(from, i))
      buckets.set(key, { date: key, income: 0, expense: 0 })
    }
    for (const t of transactions) {
      const key = toDateOnly(t.transactionDate)
      const bucket = buckets.get(key)
      if (!bucket) continue
      if (t.type === TransactionType.income) bucket.income += toNumber(t.amount)
      else bucket.expense += toNumber(t.amount)
    }
    return Array.from(buckets.values())
  }
}