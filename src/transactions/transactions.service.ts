import { UnprocessableEntityException, NotFoundException, Injectable } from '@nestjs/common'
import { Category, Prisma, Transaction } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { parseDateOnly, parseEndOfDay, toDateOnly } from '../common/utils/date'
import { toNumber } from '../common/utils/money'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { UpdateTransactionDto } from './dto/update-transaction.dto'

export interface TransactionFilters {
  type?: string
  categoryId?: string
  accountId?: string
  from?: string
  to?: string
  query?: string
}

export interface Paginated<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filters: TransactionFilters, page: number, limit: number): Promise<Paginated<Transaction>> {
    const where = this.buildWhere(userId, filters)
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ])

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  async get(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } })
    if (!transaction) throw new NotFoundException('Transaksi tidak ditemukan.')
    return transaction
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const category = await this.requireUsableCategory(userId, dto.categoryId)
    if (category.type !== dto.type) {
      throw new UnprocessableEntityException('Kategori tidak cocok dengan jenis transaksi.', 'TYPE_MISMATCH')
    }
    await this.requireOwnedAccount(userId, dto.accountId)

    return this.prisma.transaction.create({
      data: {
        userId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        type: dto.type,
        amount: dto.amount,
        transactionDate: parseDateOnly(dto.transactionDate),
        note: dto.note?.trim() || null,
      },
    })
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const transaction = await this.get(userId, id)

    const nextType = dto.type ?? transaction.type
    const nextCategoryId = dto.categoryId ?? transaction.categoryId
    if (dto.categoryId !== undefined || dto.type !== undefined) {
      const category = await this.requireUsableCategory(userId, nextCategoryId)
      if (category.type !== nextType) {
        throw new UnprocessableEntityException('Kategori tidak cocok dengan jenis transaksi.', 'TYPE_MISMATCH')
      }
    }
    if (dto.accountId !== undefined) {
      await this.requireOwnedAccount(userId, dto.accountId)
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        type: dto.type,
        amount: dto.amount,
        transactionDate: dto.transactionDate !== undefined ? parseDateOnly(dto.transactionDate) : undefined,
        note: dto.note !== undefined ? dto.note?.trim() || null : undefined,
      },
    })
  }

  async remove(userId: string, id: string): Promise<void> {
    const transaction = await this.get(userId, id)
    await this.prisma.transaction.delete({ where: { id: transaction.id } })
  }

  private buildWhere(userId: string, filters: TransactionFilters): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = { userId }

    if (filters.type === 'income' || filters.type === 'expense') {
      where.type = filters.type
    }
    if (filters.categoryId) where.categoryId = filters.categoryId
    if (filters.accountId) where.accountId = filters.accountId
    if (filters.from) {
      const from = parseDateOnly(filters.from)
      if (!Number.isNaN(from.getTime())) where.transactionDate = { ...(where.transactionDate as Prisma.DateTimeFilter | undefined), gte: from }
    }
    if (filters.to) {
      const to = parseEndOfDay(filters.to)
      if (!Number.isNaN(to.getTime())) where.transactionDate = { ...(where.transactionDate as Prisma.DateTimeFilter | undefined), lte: to }
    }
    if (filters.query) {
      where.note = { contains: filters.query, mode: 'insensitive' }
    }
    return where
  }

  private async requireUsableCategory(userId: string, categoryId: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, OR: [{ userId }, { userId: null }] },
    })
    if (!category) throw new NotFoundException('Kategori tidak ditemukan.')
    return category
  }

  private async requireOwnedAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } })
    if (!account) throw new NotFoundException('Akun tidak ditemukan.')
  }
}

export function transactionToResponse(
  t: Transaction,
): Omit<Transaction, 'amount' | 'transactionDate' | 'createdAt' | 'updatedAt'> & {
  amount: number
  transactionDate: string
  createdAt: string
  updatedAt: string
} {
  return {
    id: t.id,
    userId: t.userId,
    accountId: t.accountId,
    categoryId: t.categoryId,
    type: t.type,
    amount: toNumber(t.amount),
    transactionDate: toDateOnly(t.transactionDate),
    note: t.note,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}
