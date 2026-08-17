import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'
import { PublicUser } from '../auth/auth.service'
import { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User tidak ditemukan.')
    return this.toPublicUser(user)
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('User tidak ditemukan.')

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name !== undefined && dto.name.trim() ? dto.name.trim() : undefined,
        theme: dto.theme,
      },
    })
    return this.toPublicUser(updated)
  }

  private toPublicUser(user: {
    id: string
    email: string
    name: string
    theme: string
    createdAt: Date
    updatedAt: Date
  }): PublicUser {
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
