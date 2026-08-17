import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { FinancialGoal } from '@prisma/client'
import { PrismaService } from '../common/prisma/prisma.service'
import { startOfDayUtc, toDateOnly } from '../common/utils/date'
import { toNumber } from '../common/utils/money'
import { CreateGoalDto } from './dto/create-goal.dto'
import { UpdateGoalDto } from './dto/update-goal.dto'

export type GoalWithMeta = {
  id: string
  userId: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string | null
  createdAt: string
  updatedAt: string
  progress: number
  remaining: number
  remainingDays: number | null
  requiredDaily: number | null
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<GoalWithMeta[]> {
    const goals = await this.prisma.financialGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return goals.map((g) => this.decorate(g))
  }

  async get(userId: string, id: string): Promise<GoalWithMeta> {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id, userId } })
    if (!goal) throw new NotFoundException('Goal tidak ditemukan.')
    return this.decorate(goal)
  }

  async create(userId: string, dto: CreateGoalDto): Promise<GoalWithMeta> {
    const current = Math.min(Math.max(0, Math.floor(Number(dto.currentAmount ?? 0))), dto.targetAmount)
    const goal = await this.prisma.financialGoal.create({
      data: {
        userId,
        name: dto.name.trim(),
        targetAmount: dto.targetAmount,
        currentAmount: current,
        deadline: dto.deadline?.trim() ? new Date(`${dto.deadline}T00:00:00.000Z`) : null,
      },
    })
    return this.decorate(goal)
  }

  async update(userId: string, id: string, dto: UpdateGoalDto): Promise<GoalWithMeta> {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id, userId } })
    if (!goal) throw new NotFoundException('Goal tidak ditemukan.')

    const nextTarget = dto.targetAmount !== undefined ? Math.floor(Number(dto.targetAmount)) : toNumber(goal.targetAmount)
    if (dto.targetAmount !== undefined && (nextTarget <= 0 || !Number.isFinite(nextTarget))) {
      throw new UnprocessableEntityException('Target nominal harus lebih dari 0.', 'VALIDATION')
    }
    const nextCurrent = dto.currentAmount !== undefined
      ? Math.min(Math.max(0, Math.floor(Number(dto.currentAmount))), nextTarget)
      : undefined

    const updated = await this.prisma.financialGoal.update({
      where: { id },
      data: {
        name: dto.name !== undefined && dto.name.trim() ? dto.name.trim() : undefined,
        targetAmount: dto.targetAmount,
        currentAmount: nextCurrent,
        deadline: dto.deadline !== undefined
          ? dto.deadline?.trim()
            ? new Date(`${dto.deadline}T00:00:00.000Z`)
            : null
          : undefined,
      },
    })
    return this.decorate(updated)
  }

  async remove(userId: string, id: string): Promise<void> {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id, userId } })
    if (!goal) throw new NotFoundException('Goal tidak ditemukan.')
    await this.prisma.financialGoal.delete({ where: { id } })
  }

  private decorate(goal: FinancialGoal): GoalWithMeta {
    const target = toNumber(goal.targetAmount)
    const current = toNumber(goal.currentAmount)
    const progress = target > 0 ? Math.min(1, current / target) : 0
    const remaining = Math.max(0, target - current)
    const deadline = goal.deadline ? toDateOnly(goal.deadline) : null
    const remainingDays = deadline ? this.goalRemainingDays(deadline) : null
    const requiredDaily =
      deadline && current < target && remainingDays !== null && remainingDays > 0
        ? Math.ceil(remaining / remainingDays)
        : null

    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount: target,
      currentAmount: current,
      deadline,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
      progress,
      remaining,
      remainingDays,
      requiredDaily,
    }
  }

  private goalRemainingDays(deadline: string): number {
    const end = startOfDayUtc(new Date(`${deadline}T00:00:00.000Z`))
    const today = startOfDayUtc(new Date())
    if (today.getTime() > end.getTime()) return 0
    const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000)
    return Math.max(0, diff + 1)
  }
}