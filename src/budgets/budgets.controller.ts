import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator'
import { isDateOnly } from '../common/utils/date'
import { BudgetsService, BudgetSummaryItem, BudgetWithMeta, DailyLimitInfo } from './budgets.service'
import { CreateBudgetDto } from './dto/create-budget.dto'
import { UpdateBudgetDto } from './dto/update-budget.dto'

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<BudgetWithMeta[]> {
    return this.budgetsService.list(user.id)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBudgetDto): Promise<BudgetWithMeta> {
    return this.budgetsService.create(user.id, dto)
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser): Promise<BudgetSummaryItem[]> {
    return this.budgetsService.listSummary(user.id)
  }

  @Get(':id/daily-limit')
  dailyLimit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('date') date?: string,
  ): Promise<DailyLimitInfo> {
    let today = new Date()
    if (date) {
      if (!isDateOnly(date)) {
        throw new BadRequestException('Format tanggal tidak valid (YYYY-MM-DD).', 'VALIDATION')
      }
      today = new Date(`${date}T00:00:00.000Z`)
    }
    return this.budgetsService.getDailyLimit(user.id, id, today)
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<BudgetWithMeta> {
    return this.budgetsService.get(user.id, id)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetWithMeta> {
    return this.budgetsService.update(user.id, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.budgetsService.remove(user.id, id)
  }
}