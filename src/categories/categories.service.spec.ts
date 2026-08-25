import { ConflictException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../common/prisma/prisma.service'
import { CategoriesService } from './categories.service'

const userId = 'user-1'

function makeCategory(overrides: Partial<{ userId: string | null }> = {}) {
  return {
    id: 'cat-1',
    userId: userId as string | null,
    name: 'Kopi',
    type: 'expense' as const,
    icon: '☕',
    createdAt: new Date(),
    ...overrides,
  }
}

describe('CategoriesService — remove', () => {
  let prisma: Record<string, unknown> & { category: { findFirst: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> } }
  let service: CategoriesService

  beforeEach(() => {
    prisma = {
      category: {
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
    }
    service = new CategoriesService(prisma as unknown as PrismaService)
  })

  it('menolak menghapus kategori bawaan sistem', async () => {
    prisma.category.findFirst.mockResolvedValue(makeCategory({ userId: null }))

    await expect(service.remove(userId, 'cat-1')).rejects.toThrow(ForbiddenException)
    expect(prisma.category.delete).not.toHaveBeenCalled()
  })

  it('menerjemahkan FK violation (P2003) menjadi CATEGORY_IN_USE', async () => {
    prisma.category.findFirst.mockResolvedValue(makeCategory())
    prisma.category.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK violation', { code: 'P2003', clientVersion: 'test' }),
    )

    await expect(service.remove(userId, 'cat-1')).rejects.toThrow(ConflictException)
    await expect(service.remove(userId, 'cat-1')).rejects.toThrow(/masih dipakai/)
  })

  it('sukses menghapus kategori milik sendiri yang tak dipakai', async () => {
    prisma.category.findFirst.mockResolvedValue(makeCategory())
    prisma.category.delete.mockResolvedValue(makeCategory())

    await expect(service.remove(userId, 'cat-1')).resolves.toBeUndefined()
  })
})
