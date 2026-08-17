import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module'
import { BudgetsModule } from '../budgets/budgets.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  imports: [AccountsModule, BudgetsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}