import { Controller, Get } from '@nestjs/common'
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator'
import { FinancialHealthReport, FinancialHealthService } from './financial-health.service'

@Controller('financial-health')
export class FinancialHealthController {
  constructor(private readonly financialHealthService: FinancialHealthService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<FinancialHealthReport> {
    return this.financialHealthService.getReport(user.id)
  }
}