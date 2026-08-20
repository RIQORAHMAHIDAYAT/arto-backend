import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { AuthUser } from '../common/decorators/current-user.decorator'
import { AdminAuditService } from './admin-audit.service'

/**
 * Mencatat akses ke endpoint admin (siapa, kapan, aksi apa) ke tabel
 * admin_audit_logs. Gagal menulis log tidak boleh menggagalkan respons.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const request = context.switchToHttp().getRequest()
        const user = request.user as AuthUser | undefined
        if (!user) return
        const action = `${context.getClass().name}.${context.getHandler().name}`
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
          void this.audit.log(user.id, action)
        }
      }),
    )
  }
}