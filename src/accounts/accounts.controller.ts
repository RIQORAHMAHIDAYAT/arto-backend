import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator'
import { AccountsService, AccountWithBalance } from './accounts.service'
import { CreateAccountDto } from './dto/create-account.dto'
import { UpdateAccountDto } from './dto/update-account.dto'

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<AccountWithBalance[]> {
    return this.accountsService.list(user.id)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto): Promise<AccountWithBalance> {
    return this.accountsService.create(user.id, dto)
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<AccountWithBalance> {
    return this.accountsService.get(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountWithBalance> {
    return this.accountsService.update(user.id, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.accountsService.remove(user.id, id)
  }
}
