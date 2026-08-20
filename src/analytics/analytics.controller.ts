import { Controller, Get, Query } from '@nestjs/common'
import { IsIn, IsOptional, Matches } from 'class-validator'
import { Transform } from 'class-transformer'
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator'
import { AnalyticsService, AnalyticsSummary, CategoryStat, TrendPoint } from './analytics.service'

class AnalyticsQuery {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal tidak valid (YYYY-MM-DD).' })
  from?: string

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal tidak valid (YYYY-MM-DD).' })
  to?: string

  @IsOptional()
  @Transform(({ value }: { value: string }) => value ?? 'day')
  @IsIn(['day', 'week'])
  bucket?: 'day' | 'week'
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQuery): Promise<AnalyticsSummary> {
    return this.analyticsService.getSummary(user.id, { from: query.from, to: query.to })
  }

  @Get('categories')
  getCategories(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQuery): Promise<CategoryStat[]> {
    return this.analyticsService.getExpenseByCategory(user.id, { from: query.from, to: query.to })
  }

  @Get('trends')
  getTrends(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQuery): Promise<TrendPoint[]> {
    return this.analyticsService.getTrends(user.id, { from: query.from, to: query.to }, query.bucket ?? 'day')
  }
}