import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@prisma/client'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { AuthUser } from '../decorators/current-user.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles || requiredRoles.length === 0) return true

    const request = context.switchToHttp().getRequest()
    const user: AuthUser | undefined = request.user
    if (!user) throw new ForbiddenException('Akses ditolak.')

    const role = user.role as UserRole
    if (!requiredRoles.includes(role) && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Akses ditolak.')
    }
    return true
  }
}
