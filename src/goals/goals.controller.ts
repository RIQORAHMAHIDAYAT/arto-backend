import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator'
import { CreateGoalDto } from './dto/create-goal.dto'
import { GoalsService, GoalWithMeta } from './goals.service'
import { UpdateGoalDto } from './dto/update-goal.dto'

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<GoalWithMeta[]> {
    return this.goalsService.list(user.id)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGoalDto): Promise<GoalWithMeta> {
    return this.goalsService.create(user.id, dto)
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<GoalWithMeta> {
    return this.goalsService.get(user.id, id)
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGoalDto): Promise<GoalWithMeta> {
    return this.goalsService.update(user.id, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.goalsService.remove(user.id, id)
  }
}