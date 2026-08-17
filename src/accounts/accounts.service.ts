import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Account, TransactionType } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { toNumber } from '../common/utils/money'
import { CreateAccountDto } from './dto/create-account.dto'
import { UpdateAccountDto } from './dto/update-account.dto'

export interface AccountWithBalance extends Account {
  balance: number
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AccountWithBalance[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    const balances = await this.computeBalances(userId)
    return accounts.map((a) => ({ ...a, balance: balances.get(a.id) ?? 0 }))
  }

  async get(userId: string, id: string): Promise<AccountWithBalance> {
    const account = await this.prisma.account.findFirst({ where: { id, userId } })
    if (!account) throw new NotFoundException('Akun tidak ditemukan.')
    const balance = await this.balanceOf(userId, account.id)
    return { ...account, balance }
  }

  async create(userId: string, dto: CreateAccountDto): Promise<AccountWithBalance> {
    const account = await this.prisma.account.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        initialBalance: dto.initialBalance ?? 0,
      },
    })
    return { ...account, balance: toNumber(account.initialBalance) }
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountWithBalance> {
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
    return { ...updated, balance }
  }

  async remove(userId: string, id: string): Promise<void> {
    const account = await this.prisma.account.findFirst({ where: { id, userId } })
    if (!account) throw new NotFoundException('Akun tidak ditemukan.')
    const count = await this.prisma.transaction.count({ where: { accountId: id } })
    if (count > 0) {
      throw new ConflictException('Akun memiliki transaksi dan tidak dapat dihapus.', 'ACCOUNT_HAS_TRANSACTIONS')
    }
    await this.prisma.account.delete({ where: { id } })
  }

  private async computeBalances(userId: string): Promise<Map<string, number>> {
    const [accounts, transactions] = await Promise.all([
      this.prisma.account.findMany({ where: { userId } }),
      this.prisma.transaction.findMany({ where: { userId }, select: { accountId: true, type: true, amount: true } }),
    ])
    const map = new Map<string, number>()
    for (const a of accounts) map.set(a.id, toNumber(a.initialBalance))
    for (const t of transactions) {
      const current = map.get(t.accountId) ?? 0
      map.set(t.accountId, t.type === TransactionType.income ? current + toNumber(t.amount) : current - toNumber(t.amount))
    }
    return map
  }

  private async balanceOf(userId: string, accountId: string): Promise<number> {
    const balances = await this.computeBalances(userId)
    return balances.get(accountId) ?? 0
  }
}
