import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { Budget } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { parseDateOnly, toDateOnly } from '../common/utils/date'
import { toNumber } from '../common/utils/money'
import {
  budgetUtilization,
  calculateDailyLimit,
  parsePeriodEnd,
  remainingToday,
} from './daily-limit.util'
import { CreateBudgetDto } from './dto/create-budget.dto'
import { UpdateBudgetDto } from './dto/update-budget.dto'

export interface BudgetWithMeta {
  id: string
  userId: string
  categoryId: string
  amount: number
  periodStart: string
  periodEnd: string
  createdAt: string
  updatedAt: string
  spent: number
  utilization: number
  categoryName: string
  categoryIcon: string
}

export interface BudgetSummaryItem {
  budgetId: string
  categoryId: string
  categoryName: string
  categoryIcon: string
  spent: number
  amount: number
  utilization: number
}

export interface DailyLimitInfo {
  budgetId: string
  categoryName: string
  periodEnd: string
  remainingBudget: number
  remainingDays: number
  dailyLimit: number
  spentToday: number
  remainingToday: number
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<BudgetWithMeta[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { periodEnd: 'desc' },
    })
    const spentMap = await this.spentPerBudget(userId, budgets)
    return budgets.map((b) => this.decorate(b, spentMap.get(b.id) ?? 0))
  }

  async get(userId: string, id: string): Promise<BudgetWithMeta> {
    const budget = await this.findOwned(userId, id)
    const spent = await this.spentForBudget(userId, budget.categoryId, budget.periodStart, budget.periodEnd)
    return this.decorate(budget, spent)
  }

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetWithMeta> {
    if (dto.periodEnd < dto.periodStart) {
      throw new UnprocessableEntityException('Periode budget tidak valid.', 'VALIDATION')
    }
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, OR: [{ userId }, { userId: null }] },
    })
    if (!category) throw new NotFoundException('Kategori tidak ditemukan.')

    const start = parseDateOnly(dto.periodStart)
    const end = parsePeriodEnd(dto.periodEnd)
    const overlap = await this.prisma.budget.findFirst({
      where: {
        userId,
        categoryId: dto.categoryId,
        periodStart: { lte: end },
        periodEnd: { gte: start },
      },
    })
    if (overlap) {
      throw new ConflictException('Sudah ada budget untuk kategori pada periode ini.', 'DUPLICATE_BUDGET')
    }

    const budget = await this.prisma.budget.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        periodStart: start,
        periodEnd: end,
      },
      include: { category: true },
    })
    return this.decorate(budget, 0)
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto): Promise<BudgetWithMeta> {
    const budget = await this.findOwned(userId, id)
    const nextStart = dto.periodStart !== undefined ? dto.periodStart : toDateOnly(budget.periodStart)
    const nextEnd = dto.periodEnd !== undefined ? dto.periodEnd : toDateOnly(budget.periodEnd)
    if (nextEnd < nextStart) {
      throw new UnprocessableEntityException('Periode budget tidak valid.', 'VALIDATION')
    }
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, OR: [{ userId }, { userId: null }] },
      })
      if (!category) throw new NotFoundException('Kategori tidak ditemukan.')
    }

    const updated = await this.prisma.budget.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        amount: dto.amount,
        periodStart: dto.periodStart !== undefined ? parseDateOnly(dto.periodStart) : undefined,
        periodEnd: dto.periodEnd !== undefined ? parsePeriodEnd(dto.periodEnd) : undefined,
      },
      include: { category: true },
    })
    const spent = await this.spentForBudget(userId, updated.categoryId, updated.periodStart, updated.periodEnd)
    return this.decorate(updated, spent)
  }

  async remove(userId: string, id: string): Promise<void> {
    const budget = await this.findOwned(userId, id)
    await this.prisma.budget.delete({ where: { id: budget.id } })
  }

  async getDailyLimit(userId: string, id: string, today = new Date()): Promise<DailyLimitInfo> {
    const budget = await this.findOwned(userId, id)
    const category = budget.category
    const spent = await this.spentForBudget(userId, budget.categoryId, budget.periodStart, budget.periodEnd)

    const result = calculateDailyLimit({
      budgetAmount: toNumber(budget.amount),
      spent,
      today,
      periodEnd: budget.periodEnd,
    })

    const todayStr = toDateOnly(today)
    const spentToday = await this.spentOnDate(userId, budget.categoryId, todayStr)
    const active = toDateOnly(today) <= toDateOnly(budget.periodEnd)
    const dailyLimit = active ? result.dailyLimit : 0

    return {
      budgetId: budget.id,
      categoryName: category?.name ?? 'Kategori',
      periodEnd: toDateOnly(budget.periodEnd),
      remainingBudget: result.remainingBudget,
      remainingDays: result.remainingDays,
      dailyLimit,
      spentToday,
      remainingToday: remainingToday(spentToday, dailyLimit),
    }
  }

  async listSummary(userId: string): Promise<BudgetSummaryItem[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { category: true },
    })
    const spentMap = await this.spentPerBudget(userId, budgets)
    return budgets.map((b) => {
      const spent = spentMap.get(b.id) ?? 0
      return {
        budgetId: b.id,
        categoryId: b.categoryId,
        categoryName: b.category?.name ?? 'Tanpa Kategori',
        categoryIcon: b.category?.icon ?? '📦',
        spent,
        amount: toNumber(b.amount),
        utilization: budgetUtilization(spent, toNumber(b.amount)),
      }
    })
  }

  async pickActiveBudget(userId: string, today = new Date()): Promise<Budget | null> {
    const budgets = await this.prisma.budget.findMany({ where: { userId }, include: { category: true } })
    if (budgets.length === 0) return null
    const todayStr = toDateOnly(today)
    const active = budgets.find((b) => toDateOnly(b.periodStart) <= todayStr && todayStr <= toDateOnly(b.periodEnd))
    return active ?? budgets[0]
  }

  private async findOwned(userId: string, id: string): Promise<Budget & { category: { name: string; icon: string } | null }> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
      include: { category: true },
    })
    if (!budget) throw new NotFoundException('Budget tidak ditemukan.')
    return budget
  }

  private decorate(
    budget: Budget & { category: { name: string; icon: string } | null },
    spent: number,
  ): BudgetWithMeta {
    const amount = toNumber(budget.amount)
    return {
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      amount,
      periodStart: toDateOnly(budget.periodStart),
      periodEnd: toDateOnly(budget.periodEnd),
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
      spent,
      utilization: budgetUtilization(spent, amount),
      categoryName: budget.category?.name ?? 'Tanpa Kategori',
      categoryIcon: budget.category?.icon ?? '📦',
    }
  }

  private async spentForBudget(userId: string, categoryId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: 'expense',
        transactionDate: { gte: periodStart, lte: periodEnd },
      },
      _sum: { amount: true },
    })
    return toNumber(result._sum.amount)
  }

  private async spentOnDate(userId: string, categoryId: string, date: string): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: 'expense',
        transactionDate: { gte: parseDateOnly(date), lte: parsePeriodEnd(date) },
      },
      _sum: { amount: true },
    })
    return toNumber(result._sum.amount)
  }

  private async spentPerBudget(userId: string, budgets: Array<Pick<Budget, 'id' | 'categoryId' | 'periodStart' | 'periodEnd'>>): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    if (budgets.length === 0) return map

    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'expense',
        OR: budgets.map((b) => ({
          categoryId: b.categoryId,
          transactionDate: { gte: b.periodStart, lte: b.periodEnd },
        })),
      },
      _sum: { amount: true },
    })
    const sumByCategory = new Map(grouped.map((g) => [g.categoryId, toNumber(g._sum.amount)]))

    for (const b of budgets) {
      const sum = sumByCategory.get(b.categoryId) ?? 0
      if (sum > 0) map.set(b.id, sum)
    }
    return map
  }
}