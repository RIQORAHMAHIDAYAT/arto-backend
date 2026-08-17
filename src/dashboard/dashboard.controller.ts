import { Controller, Get } from '@nestjs/common'
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator'
import { DashboardService, DashboardSummary } from './dashboard.service'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthUser): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(user.id)
  }
}