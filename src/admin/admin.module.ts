import { Module } from '@nestjs/common'
import { AdminAuditInterceptor } from './admin-audit.interceptor'
import { AdminAuditService } from './admin-audit.service'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminAuditService, AdminAuditInterceptor],
  exports: [AdminAuditService],
})
export class AdminModule {}