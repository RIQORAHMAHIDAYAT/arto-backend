import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../common/prisma/prisma.service'

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  async log(adminId: string, action: string, detail?: string | null): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: { adminId, action, detail: detail?.slice(0, 500) || null },
      })
    } catch (err) {
      // Audit tidak boleh menggagalkan alur admin.
      this.logger.error(
        `Gagal menulis audit log: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}