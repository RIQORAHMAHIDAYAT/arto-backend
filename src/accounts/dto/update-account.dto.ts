import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { AccountType } from '@prisma/client'

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(1_000_000_000_000)
  initialBalance?: number
}
