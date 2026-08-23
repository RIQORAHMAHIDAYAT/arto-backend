import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { AdminAuditInterceptor } from './admin-audit.interceptor'
import { AdminService } from './admin.service'

@Controller('admin')
@UseGuards(RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  overview() {
    return this.adminService.overview()
  }

  @Get('users/statistics')
  usersStatistics(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('query') query?: string,
  ) {
    const safePage = Math.max(1, Number(page) || 1)
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
    return this.adminService.usersStatistics(safePage, safeLimit, query?.trim() || undefined)
  }

  @Get('transactions/statistics')
  transactionsStatistics() {
    return this.adminService.transactionsStatistics()
  }
}