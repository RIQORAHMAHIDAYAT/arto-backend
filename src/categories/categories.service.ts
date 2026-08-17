import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Category, TransactionType } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, type?: TransactionType): Promise<Category[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null }],
        ...(type ? { type } : {}),
      },
      orderBy: [{ userId: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    })
    return categories
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type,
        icon: dto.icon?.trim() || '📦',
      },
    })
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOwned(userId, id)
    if (category.userId === null) {
      throw new ForbiddenException('Kategori bawaan tidak dapat diubah.', 'FORBIDDEN')
    }
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name !== undefined && dto.name.trim() ? dto.name.trim() : undefined,
        type: dto.type,
        icon: dto.icon !== undefined && dto.icon.trim() ? dto.icon.trim() : undefined,
      },
    })
  }

  async remove(userId: string, id: string): Promise<void> {
    const category = await this.findOwned(userId, id)
    if (category.userId === null) {
      throw new ForbiddenException('Kategori bawaan tidak dapat dihapus.', 'FORBIDDEN')
    }
    const [txCount, budgetCount] = await Promise.all([
      this.prisma.transaction.count({ where: { categoryId: id } }),
      this.prisma.budget.count({ where: { categoryId: id } }),
    ])
    if (txCount > 0 || budgetCount > 0) {
      throw new ConflictException('Kategori masih dipakai dan tidak dapat dihapus.', 'CATEGORY_IN_USE')
    }
    await this.prisma.category.delete({ where: { id } })
  }

  private async findOwned(userId: string, id: string): Promise<Category> {
    const category = await this.prisma.category.findFirst({
      where: { id, OR: [{ userId }, { userId: null }] },
    })
    if (!category) throw new NotFoundException('Kategori tidak ditemukan.')
    return category
  }
}
