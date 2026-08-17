import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import { TransactionType } from '@prisma/client'

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama kategori wajib diisi.' })
  @MaxLength(120)
  name: string

  @IsEnum(TransactionType)
  type: TransactionType

  @IsOptional()
  @IsString()
  @MaxLength(20)
  icon?: string
}
