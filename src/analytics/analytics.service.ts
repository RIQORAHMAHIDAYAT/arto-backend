import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { TransactionType } from '@prisma/client'
import { addDaysUtc, daysBetweenInclusive, parseDateOnly, parseEndOfDay, toDateOnly } from '../common/utils/date'
import { toNumber } from '../common/utils/money'

export interface AnalyticsRange {
  from?: string
  to?: string
}

export interface AnalyticsSummary {
  income: number
  expense: number
  net: number
  averageSpending: number
  transactionCount: number
}

export interface CategoryStat {
  categoryId: string
  categoryName: string
  categoryIcon: string
  amount: number
  percentage: number
}

export interface TrendPoint {
  label: string
  income: number
  expense: number
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string, range: AnalyticsRange): Promise<AnalyticsSummary> {
    const { from, to } = this.resolveRange(range)
    const result = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, transactionDate: { gte: parseDateOnly(from), lte: parseEndOfDay(to) } },
      _sum: { amount: true },
      _count: { _all: true },
    })

    const income = result.find((r) => r.type === TransactionType.income)
    const expense = result.find((r) => r.type === TransactionType.expense)
    const incomeAmount = toNumber(income?._sum.amount)
    const expenseAmount = toNumber(expense?._sum.amount)
    const transactionCount = (income?._count._all ?? 0) + (expense?._count._all ?? 0)

    const dayCount = daysBetweenInclusive(parseDateOnly(from), parseDateOnly(to))
    return {
      income: incomeAmount,
      expense: expenseAmount,
      net: incomeAmount - expenseAmount,
      averageSpending: dayCount > 0 ? Math.round(expenseAmount / dayCount) : 0,
      transactionCount,
    }
  }

  async getExpenseByCategory(userId: string, range: AnalyticsRange): Promise<CategoryStat[]> {
    const { from, to } = this.resolveRange(range)
    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: TransactionType.expense,
        transactionDate: { gte: parseDateOnly(from), lte: parseEndOfDay(to) },
      },
      _sum: { amount: true },
    })
    if (grouped.length === 0) return []

    const categoryIds = [...new Set(grouped.map((g) => g.categoryId))]
    const categories = await this.prisma.category.findMany({ where: { id: { in: categoryIds } } })
    const catByName = new Map(categories.map((c) => [c.id, c]))

    const total = grouped.reduce((sum, g) => sum + toNumber(g._sum.amount), 0)
    const stats: CategoryStat[] = grouped.map((g) => {
      const category = catByName.get(g.categoryId)
      const amount = toNumber(g._sum.amount)
      return {
        categoryId: g.categoryId,
        categoryName: category?.name ?? 'Tanpa Kategori',
        categoryIcon: category?.icon ?? '📦',
        amount,
        percentage: total > 0 ? amount / total : 0,
      }
    })
    return stats.sort((a, b) => b.amount - a.amount)
  }

  async getTrends(userId: string, range: AnalyticsRange, bucket: 'day' | 'week'): Promise<TrendPoint[]> {
    const { from, to } = this.resolveRange(range)
    const transactions = await this.prisma.transaction.findMany({
      where: { userId, transactionDate: { gte: parseDateOnly(from), lte: parseEndOfDay(to) } },
      select: { transactionDate: true, type: true, amount: true },
    })

    const keyOf = (date: Date): string => {
      if (bucket === 'week') return toDateOnly(this.mondayOf(date))
      return toDateOnly(date)
    }

    const map = new Map<string, { income: number; expense: number }>()
    for (const t of transactions) {
      const key = keyOf(t.transactionDate)
      const current = map.get(key) ?? { income: 0, expense: 0 }
      if (t.type === TransactionType.income) current.income += toNumber(t.amount)
      else current.expense += toNumber(t.amount)
      map.set(key, current)
    }

    const fromDate = parseDateOnly(from)
    const toDate = parseDateOnly(to)
    const keys: string[] = []
    if (bucket === 'week') {
      // Sejajarkan bucket dengan Senin (awal pekan) agar cocok dengan key transaksi,
      // lalu maju mundur 7 hari dari minggu terakhir.
      let cursor = this.mondayOf(toDate)
      while (cursor.getTime() >= fromDate.getTime()) {
        keys.push(toDateOnly(cursor))
        cursor = addDaysUtc(cursor, -7)
      }
      keys.reverse()
    } else {
      for (let d = new Date(fromDate); d <= toDate; d = addDaysUtc(d, 1)) {
        keys.push(toDateOnly(d))
      }
    }

    return keys.map((key) => {
      const value = map.get(key) ?? { income: 0, expense: 0 }
      const label = bucket === 'week' ? this.weekLabel(key) : key.slice(8)
      return { label, income: value.income, expense: value.expense }
    })
  }

  private resolveRange(range: AnalyticsRange): { from: string; to: string } {
    const now = new Date()
    const from = range.from ?? toDateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
    const to = range.to ?? toDateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)))
    const fromDate = parseDateOnly(from)
    const toDate = parseDateOnly(to)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Parameter tanggal tidak valid (YYYY-MM-DD).', 'VALIDATION')
    }
    return { from, to }
  }

  private mondayOf(date: Date): Date {
    const d = new Date(date)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
    return d
  }

  private weekLabel(mondayKey: string): string {
    const start = parseDateOnly(mondayKey)
    const end = addDaysUtc(start, 6)
    const fmt = (date: Date): string =>
      `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    return `${fmt(start)} – ${fmt(end)}`
  }
}