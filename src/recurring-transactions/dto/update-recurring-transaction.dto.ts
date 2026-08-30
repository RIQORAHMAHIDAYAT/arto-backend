import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateRecurringTransactionDto {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
