import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AccountsModule } from './accounts/accounts.module'
import { AdminModule } from './admin/admin.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { AppController } from './app.controller'
import { AuthModule } from './auth/auth.module'
import { BudgetsModule } from './budgets/budgets.module'
import { CategoriesModule } from './categories/categories.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { PrismaModule } from './common/prisma/prisma.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { FinancialHealthModule } from './financial-health/financial-health.module'
import { GoalsModule } from './goals/goals.module'
import { TransactionsModule } from './transactions/transactions.module'
import { UsersModule } from './users/users.module'
import { parseDurationToSeconds } from './common/utils/time'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL_MS', 60_000),
            limit: config.get<number>('THROTTLE_LIMIT', 120),
          },
        ],
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret'),
        signOptions: {
          expiresIn: parseDurationToSeconds(config.get<string>('JWT_ACCESS_TTL', '15m')),
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
    DashboardModule,
    AnalyticsModule,
    FinancialHealthModule,
    GoalsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}