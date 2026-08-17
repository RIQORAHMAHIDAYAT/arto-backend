import { Transform } from 'class-transformer'
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama goal wajib diisi.' })
  @MaxLength(120)
  name: string

  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1_000_000_000_000)
  targetAmount: number

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(1_000_000_000_000)
  currentAmount?: number

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Deadline wajib dalam format YYYY-MM-DD.' })
  deadline?: string | null
}