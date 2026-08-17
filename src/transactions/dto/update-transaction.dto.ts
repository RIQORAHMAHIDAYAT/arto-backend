import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'
import { Transform } from 'class-transformer'
import { TransactionType } from '@prisma/client'

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  accountId?: string

  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1_000_000_000_000)
  amount?: number

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal wajib dalam format YYYY-MM-DD.' })
  transactionDate?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null
}
