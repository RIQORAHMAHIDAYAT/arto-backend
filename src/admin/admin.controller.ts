import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common'
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
  usersStatistics() {
    return this.adminService.usersStatistics()
  }

  @Get('transactions/statistics')
  transactionsStatistics() {
    return this.adminService.transactionsStatistics()
  }
}