import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Public } from '../common/decorators/public.decorator'
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator'
import { AuthService, AuthResult, TokenPair } from './auth.service'
import { ChangePasswordDto } from './dto/change-password.dto'
import { LoginDto } from './dto/login.dto'
import { RefreshDto } from './dto/refresh.dto'
import { RegisterDto } from './dto/register.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto)
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto)
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken)
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken)
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto)
  }
}
