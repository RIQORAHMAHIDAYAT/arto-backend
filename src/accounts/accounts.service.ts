import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Account, AccountType, TransactionType } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { toNumber } from '../common/utils/money'
import { isForeignKeyViolation } from '../common/utils/prisma-errors'
import { CreateAccountDto } from './dto/create-account.dto'
import { UpdateAccountDto } from './dto/update-account.dto'

/**
 * Bentuk respons akun yang dipetakan ke nilai primitif, konsisten dengan
 * resource lain (transaction/budget/goal): Decimal → number,
 * tanggal → string ISO. Mencegah `initialBalance` terserialisasi sebagai
 * string saat dikirim ke klien.
 */
export interface AccountResponse {
  id: string
  userId: string
  name: string
  type: AccountType
  initialBalance: number
  balance: number
  createdAt: string
  updatedAt: string
}

function toResponse(account: Account, balance: number): AccountResponse {
  return {
    id: account.id,
    userId: account.userId,
    name: account.name,
    type: account.type,
    initialBalance: toNumber(account.initialBalance),
    balance,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AccountResponse[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    const balances = await this.computeBalances(userId)
    return accounts.map((a) => toResponse(a, balances.get(a.id) ?? 0))
  }

  async get(userId: string, id: string): Promise<AccountResponse> {
    const account = await this.prisma.account.findFirst({ where: { id, userId } })
    if (!account) throw new NotFoundException('Akun tidak ditemukan.')
    const balance = await this.balanceOf(userId, account.id)
    return toResponse(account, balance)
  }

  async create(userId: string, dto: CreateAccountDto): Promise<AccountResponse> {
    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        initialBalance: dto.initialBalance ?? 0,
      },
    })
    return toResponse(account, toNumber(account.initialBalance))
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountResponse> {
    const account = await this.prisma.account.findFirst({ where: { id, userId } })
    if (!account) throw new NotFoundException('Akun tidak ditemukan.')
    const updated = await this.prisma.account.update({
      where: { id },
      data: {
        name: dto.name !== undefined && dto.name.trim() ? dto.name.trim() : undefined,
        type: dto.type,
        initialBalance: dto.initialBalance,
      },
    })
    const balance = await this.balanceOf(userId, updated.id)
    return toResponse(updated, balance)
  }

  async remove(userId: string, id: string): Promise<void> {
    const account = await this.prisma.account.findFirst({ where: { id, userId } })
    if (!account) throw new NotFoundException('Akun tidak ditemukan.')
    // Hapus langsung; FK Restrict transaksi → akun di database bersifat atomik
    // (tidak ada celah antara pengecekan dan penghapusan).
    try {
      await this.prisma.account.delete({ where: { id } })
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new ConflictException('Akun memiliki transaksi dan tidak dapat dihapus.', 'ACCOUNT_HAS_TRANSACTIONS')
      }
      throw err
    }
  }

  private async computeBalances(userId: string): Promise<Map<string, number>> {
    const [accounts, grouped] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId },
        select: { id: true, initialBalance: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['accountId', 'type'],
        where: { userId },
        _sum: { amount: true },
      }),
    ])
    const map = new Map<string, number>()
    for (const a of accounts) map.set(a.id, toNumber(a.initialBalance))
    for (const g of grouped) {
      const current = map.get(g.accountId) ?? 0
      map.set(
        g.accountId,
        g.type === TransactionType.income
          ? current + toNumber(g._sum.amount)
          : current - toNumber(g._sum.amount),
      )
    }
    return map
  }

  private async balanceOf(userId: string, accountId: string): Promise<number> {
    const [account, grouped] = await Promise.all([
      this.prisma.account.findUnique({
        where: { id: accountId },
        select: { initialBalance: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { userId, accountId },
        _sum: { amount: true },
      }),
    ])

    let delta = 0
    for (const g of grouped) {
      delta +=
        g.type === TransactionType.income ? toNumber(g._sum.amount) : -toNumber(g._sum.amount)
    }
    return toNumber(account?.initialBalance) + delta
  }
}
