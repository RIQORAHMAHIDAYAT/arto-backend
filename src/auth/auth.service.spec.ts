import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../common/prisma/prisma.service'
import { AuthService } from './auth.service'

const userId = 'user-1'

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: userId,
    email: 'uji@arto.id',
    name: 'Penguji',
    theme: 'system',
    role: 'USER',
    passwordHash: '$2a$12$hash',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('AuthService', () => {
  let tx: {
    refreshToken: {
      update: ReturnType<typeof vi.fn>
      deleteMany: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
    }
  }
  let prisma: Record<string, unknown> & {
    $transaction: ReturnType<typeof vi.fn>
    refreshToken: { findUnique: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> }
    user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  }
  let service: AuthService

  beforeEach(() => {
    tx = { refreshToken: { update: vi.fn(), deleteMany: vi.fn(), create: vi.fn() } }
    prisma = {
      $transaction: vi.fn(async (cb: (client: typeof tx) => unknown) => cb(tx)),
      refreshToken: { findUnique: vi.fn(), updateMany: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
    }
    const jwt = { signAsync: vi.fn().mockResolvedValue('access-token') }
    const config = { get: vi.fn().mockReturnValue(30) }
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    )
  })

  describe('refresh (rotasi token)', () => {
    const validToken = 'token-aktif'
    const record = {
      id: 'rt-1',
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    }

    it('melempar Unauthorized saat token tidak ada / sudah revoked / kedaluwarsa', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null)
      await expect(service.refresh(validToken)).rejects.toThrow(UnauthorizedException)

      prisma.refreshToken.findUnique.mockResolvedValue({ ...record, revokedAt: new Date() })
      await expect(service.refresh(validToken)).rejects.toThrow(UnauthorizedException)

      prisma.refreshToken.findUnique.mockResolvedValue({ ...record, expiresAt: new Date(Date.now() - 1000) })
      await expect(service.refresh(validToken)).rejects.toThrow(UnauthorizedException)

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('melempar Unauthorized saat user sudah tidak ada', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(record)
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.refresh(validToken)).rejects.toThrow(UnauthorizedException)
    })

    it('merotasi atomik: revoke lama + bersihkan expired + buat token baru', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(record)
      prisma.user.findUnique.mockResolvedValue(makeUser())
      tx.refreshToken.create.mockResolvedValue({})

      const result = await service.refresh(validToken)

      expect(tx.refreshToken.update).toHaveBeenCalledWith({
        where: { id: record.id },
        data: { revokedAt: expect.any(Date) },
      })
      expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId, expiresAt: { lt: expect.any(Date) } },
      })
      expect(tx.refreshToken.create).toHaveBeenCalledWith({
        data: { userId, tokenHash: expect.any(String), expiresAt: expect.any(Date) },
      })
      expect(result).toEqual({ accessToken: 'access-token', refreshToken: expect.any(String) })
    })
  })

  describe('logout', () => {
    it('merevoke token yang masih aktif saja', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })

      await service.logout('token-aktif')

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expect.any(String), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    })
  })

  describe('changePassword', () => {
    it('menolak password lama yang salah', async () => {
      const realHash = await bcrypt.hash('PasswordBenar123!', 4)
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash: realHash }))

      await expect(
        service.changePassword(userId, { currentPassword: 'PasswordSalah!', newPassword: 'Baru12345!' }),
      ).rejects.toThrow(/Password saat ini salah/)
      // Tidak boleh menyentuh database saat verifikasi gagal.
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('mengubah hash dan mencabut semua sesi refresh', async () => {
      const oldHash = await bcrypt.hash('PasswordLama123!', 4)
      prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash: oldHash }))
      prisma.user.update.mockResolvedValue(makeUser())
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })
      prisma.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops))

      await service.changePassword(userId, { currentPassword: 'PasswordLama123!', newPassword: 'PasswordBaru123!' })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: expect.not.stringMatching(oldHash) },
      })
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    })
  })
})
