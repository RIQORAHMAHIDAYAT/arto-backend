import { ConflictException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../common/prisma/prisma.service'
import { BudgetsService } from './budgets.service'

type TxStub = {
  budget: {
    findFirst: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

const userId = 'user-1'
const categoryId = 'cat-1'

function makeBudget(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'budget-1',
    userId,
    categoryId,
    amount: 500000,
    periodStart: new Date('2026-08-01T00:00:00.000Z'),
    periodEnd: new Date('2026-08-31T23:59:59.999Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { name: 'Makanan', icon: '🍜' },
    ...overrides,
  }
}

describe('BudgetsService — anti-overlap', () => {
  let tx: TxStub
  let prisma: Record<string, unknown> & { $transaction: ReturnType<typeof vi.fn> }
  let service: BudgetsService

  const dto = { categoryId, amount: 500000, periodStart: '2026-08-01', periodEnd: '2026-08-31' }

  beforeEach(() => {
    tx = {
      budget: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    }
    // $transaction mengeksekusi callback dengan stub transaksi, meniru perilaku nyata.
    prisma = {
      $transaction: vi.fn(async (cb: (txClient: TxStub) => unknown) => cb(tx)),
      budget: {},
      category: {
        // Lookup kategori sebelum transaksi (kategori sistem expense).
        findFirst: vi.fn().mockResolvedValue({ id: categoryId, userId: null, name: 'Makanan', icon: '🍜', type: 'expense' }),
      },
    }
    service = new BudgetsService(prisma as unknown as PrismaService)
  })

  it('create menolak dengan ConflictException saat overlap ditemukan', async () => {
    tx.budget.findFirst.mockResolvedValue(makeBudget())

    await expect(service.create(userId, dto)).rejects.toThrow(ConflictException)
    expect(tx.budget.create).not.toHaveBeenCalled()
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('create memanggil cek overlap DAN insert di dalam transaksi yang sama', async () => {
    tx.budget.findFirst.mockResolvedValue(null)
    tx.budget.create.mockResolvedValue(makeBudget())

    await service.create(userId, dto)

    expect(tx.budget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId, categoryId }) }),
    )
    expect(tx.budget.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.anything() }))
  })

  it('create menerjemahkan pelanggaran constraint DB (23P01) menjadi ConflictException', async () => {
    tx.budget.findFirst.mockResolvedValue(null)
    // Simulasi dua request konkuren: cek lolos, tapi constraint DB menolak insert.
    tx.budget.create.mockRejectedValue(
      new Prisma.PrismaClientUnknownRequestError(
        'conflicting key value violates exclusion constraint "budgets_no_overlap" (23P01)',
        { clientVersion: 'test' },
      ),
    )

    await expect(service.create(userId, dto)).rejects.toThrow(/Sudah ada budget/)
  })

  it('update menolak saat beririsan dengan budget lain pada kategori sama', async () => {
    const existing = makeBudget()
    // findOwned memakai prisma.budget.findFirst (di luar transaksi)
    prisma.budget = {
      findFirst: vi.fn().mockResolvedValue(existing),
      delete: vi.fn(),
    } as never
    tx.budget.findFirst.mockResolvedValue(makeBudget({ id: 'budget-lain' }))

    await expect(service.update(userId, 'budget-1', dto)).rejects.toThrow(ConflictException)
    expect(tx.budget.update).not.toHaveBeenCalled()
  })
})
