import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { TransactionType } from '@prisma/client'

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType

  @IsOptional()
  @IsString()
  @MaxLength(20)
  icon?: string
}
