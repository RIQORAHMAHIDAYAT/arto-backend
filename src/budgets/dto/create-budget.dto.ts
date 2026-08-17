import { Transform } from 'class-transformer'
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator'

export class CreateBudgetDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string

  @Transform(({ value }: { value: string }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1_000_000_000_000)
  amount: number

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Periode mulai wajib dalam format YYYY-MM-DD.' })
  periodStart: string

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Periode berakhir wajib dalam format YYYY-MM-DD.' })
  periodEnd: string
}