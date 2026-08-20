import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { IsEnum, IsOptional } from 'class-validator'
import { TransactionType } from '@prisma/client'
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator'
import { CategoriesService } from './categories.service'
import { CreateCategoryDto } from './dto/create-category.dto'
import { UpdateCategoryDto } from './dto/update-category.dto'

class CategoryQuery {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: CategoryQuery) {
    return this.categoriesService.list(user.id, query.type)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.id, dto)
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(user.id, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.categoriesService.remove(user.id, id)
  }
}
