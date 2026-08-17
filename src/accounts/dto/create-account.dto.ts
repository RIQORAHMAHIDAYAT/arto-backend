import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { AccountType } from '@prisma/client'

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama akun wajib diisi.' })
  @MaxLength(120)
  name: string

  @IsEnum(AccountType)
  type: AccountType

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(1_000_000_000_000)
  initialBalance?: number
}
