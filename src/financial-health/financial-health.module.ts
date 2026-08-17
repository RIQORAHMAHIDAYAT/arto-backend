import { Module } from '@nestjs/common'
import { FinancialHealthController } from './financial-health.controller'
import { FinancialHealthService } from './financial-health.service'

@Module({
  controllers: [FinancialHealthController],
  providers: [FinancialHealthService],
})
export class FinancialHealthModule {}