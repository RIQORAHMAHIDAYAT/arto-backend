import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { User } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../common/prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

export interface PublicUser {
  id: string
  email: string
  name: string
  theme: string
  createdAt: string
  updatedAt: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface AuthResult extends TokenPair {
  user: PublicUser
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new UnauthorizedException('Email sudah terdaftar. Silakan login.', 'EMAIL_EXISTS')
    }

    const name = (dto.name ?? '').trim() || dto.email.split('@')[0]
    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name },
    })

    const tokens = await this.issueTokens(user)
    return { ...tokens, user: this.toPublicUser(user) }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) {
      throw new UnauthorizedException('Email atau password salah.', 'INVALID_CREDENTIALS')
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash)
    if (!ok) {
      throw new UnauthorizedException('Email atau password salah.', 'INVALID_CREDENTIALS')
    }

    const tokens = await this.issueTokens(user)
    return { ...tokens, user: this.toPublicUser(user) }
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken)
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!record || record.revokedAt !== null || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sesi tidak valid atau sudah kedaluwarsa.', 'INVALID_REFRESH_TOKEN')
    }

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } })
    if (!user) throw new UnauthorizedException('Sesi tidak valid.', 'INVALID_REFRESH_TOKEN')

    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } })
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    })

    return this.issueTokens(user)
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken)
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    const refreshToken = randomBytes(48).toString('hex')
    const ttlDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30)
    const expiresAt = new Date(Date.now() + ttlDays * 86_400_000)

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: this.hashToken(refreshToken), expiresAt },
    })

    return { accessToken, refreshToken }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      theme: user.theme,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }
  }
}
