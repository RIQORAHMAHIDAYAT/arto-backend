import { NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../common/prisma/prisma.service'
import { AccountsService } from './accounts.service'

const userId = 'user-1'

function makeAccount() {
  return {
    id: 'acc-1',
    userId,
    name: 'Kas',
    type: 'cash' as const,
    initialBalance: 100000,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('AccountsService — remove anti-TOCTOU', () => {
  let prisma: Record<string, unknown> & { account: { findFirst: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } }
  let service: AccountsService

  beforeEach(() => {
    prisma = {
      account: {
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
    }
    service = new AccountsService(prisma as unknown as PrismaService)
  })

  it('melempar NotFoundException saat akun bukan milik user / tidak ada', async () => {
    prisma.account.findFirst.mockResolvedValue(null)

    await expect(service.remove(userId, 'acc-1')).rejects.toThrow(NotFoundException)
    expect(prisma.account.delete).not.toHaveBeenCalled()
  })

  it('menerjemahkan FK violation (P2003) menjadi ConflictException ramah', async () => {
    prisma.account.findFirst.mockResolvedValue(makeAccount())
    // Simulasi race: count bilangan kosong, tapi transaksi baru dibuat sebelum delete.
    prisma.account.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK violation', { code: 'P2003', clientVersion: 'test' }),
    )

    await expect(service.remove(userId, 'acc-1')).rejects.toThrow(/memiliki transaksi/)
  })

  it('sukses menghapus akun tanpa transaksi', async () => {
    prisma.account.findFirst.mockResolvedValue(makeAccount())
    prisma.account.delete.mockResolvedValue(makeAccount())

    await expect(service.remove(userId, 'acc-1')).resolves.toBeUndefined()
    expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: 'acc-1' } })
  })
})
