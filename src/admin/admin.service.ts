import { Injectable } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { TransactionType } from '@prisma/client'
import { toNumber } from '../common/utils/money'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date()
    const sinceStartOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const sinceEndOfWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7))

    const [totalUsers, usersThisMonth, active7Days, totalTransactions, totalAccounts, totalCategories] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { createdAt: { gte: sinceStartOfMonth } } }),
        this.prisma.user.count({
          where: {
            OR: [
              { transactions: { some: { createdAt: { gte: sinceEndOfWeek } } } },
              { budgets: { some: { createdAt: { gte: sinceEndOfWeek } } } },
            ],
          },
        }),
        this.prisma.transaction.count(),
        this.prisma.account.count(),
        this.prisma.category.count({ where: { userId: null } }),
      ])

    return {
      user: { totalUsers, usersThisMonth, active7Days },
      transaction: { totalTransactions },
      account: { totalAccounts },
      category: { systemCategories: totalCategories },
    }
  }

  async usersStatistics() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { transactions: true, accounts: true, budgets: true, goals: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      transactionCount: u._count.transactions,
      accountCount: u._count.accounts,
      budgetCount: u._count.budgets,
      goalCount: u._count.goals,
    }))
  }

  async transactionsStatistics() {
    const now = new Date()
    const sinceStartOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    const [grouped, thisMonth, expenseByCategory] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where: { createdAt: { gte: sinceStartOfMonth } } }),
      this.prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { type: TransactionType.expense },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    const categories = await this.prisma.category.findMany({
      where: { id: { in: expenseByCategory.map((e) => e.categoryId) } },
    })
    const categoryMap = new Map(categories.map((c) => [c.id, c]))

    const income = grouped.find((g) => g.type === TransactionType.income)
    const expense = grouped.find((g) => g.type === TransactionType.expense)

    return {
      totalIncomeCount: income?._count._all ?? 0,
      totalIncomeAmount: toNumber(income?._sum.amount),
      totalExpenseCount: expense?._count._all ?? 0,
      totalExpenseAmount: toNumber(expense?._sum.amount),
      transactionsThisMonth: thisMonth,
      expenseByCategory: expenseByCategory
        .map((e) => ({
          categoryId: e.categoryId,
          categoryName: categoryMap.get(e.categoryId)?.name ?? 'Tanpa Kategori',
          categoryIcon: categoryMap.get(e.categoryId)?.icon ?? '📦',
          count: e._count._all,
          amount: toNumber(e._sum.amount),
        }))
        .sort((a, b) => b.amount - a.amount),
    }
  }
}