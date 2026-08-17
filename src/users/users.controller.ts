import { Body, Controller, Get, Patch } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { AuthUser } from '../common/decorators/current-user.decorator'
import { UpdateUserDto } from './dto/update-user.dto'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id)
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, dto)
  }
}
