import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { AuthUser } from '../decorators/current-user.decorator'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request>()
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException('Belum login.')

    try {
      const payload = await this.jwtService.verifyAsync(token)
      const user: AuthUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role ?? 'USER',
      }
      ;(request as Request & { user: AuthUser }).user = user
      return true
    } catch {
      throw new UnauthorizedException('Sesi tidak valid atau sudah kedaluwarsa.')
    }
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization
    if (!header) return null
    const [type, token] = header.split(' ')
    return type === 'Bearer' && token ? token : null
  }
}
