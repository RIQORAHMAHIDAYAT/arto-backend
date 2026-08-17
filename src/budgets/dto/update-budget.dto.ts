import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'

export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  categoryId?: string

  @IsOptional()
  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1_000_000_000_000)
  amount?: number

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Periode mulai wajib dalam format YYYY-MM-DD.' })
  periodStart?: string

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Periode berakhir wajib dalam format YYYY-MM-DD.' })
  periodEnd?: string
}