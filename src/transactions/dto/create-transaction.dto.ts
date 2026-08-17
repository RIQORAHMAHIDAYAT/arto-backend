import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'
import { TransactionType } from '@prisma/client'

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  accountId: string

  @IsString()
  @IsNotEmpty()
  categoryId: string

  @IsEnum(TransactionType)
  type: TransactionType

  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1_000_000_000_000)
  amount: number

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal wajib dalam format YYYY-MM-DD.' })
  transactionDate: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null
}
