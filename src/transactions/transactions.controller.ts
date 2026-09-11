import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, StreamableFile } from '@nestjs/common'
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator'
import { Paginated, TransactionFilters, TransactionsService, transactionToResponse } from './transactions.service'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { UpdateTransactionDto } from './dto/update-transaction.dto'

type TransactionResponse = ReturnType<typeof transactionToResponse>

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('categoryId') categoryId?: string,
    @Query('accountId') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('query') query?: string,
  ): Promise<Paginated<TransactionResponse>> {
    const safePage = Math.max(1, Number(page) || 1)
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
    const filters: TransactionFilters = { type, categoryId, accountId, from, to, query }
    const result = await this.transactionsService.list(user.id, filters, safePage, safeLimit)
    return {
      items: result.items.map(transactionToResponse),
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    }
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto): Promise<TransactionResponse> {
    return transactionToResponse(await this.transactionsService.create(user.id, dto))
  }

  @Get('export/csv')
  @HttpCode(200)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="transactions.csv"')
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: string,
    @Query('categoryId') categoryId?: string,
    @Query('accountId') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('query') query?: string,
  ): Promise<string> {
    const filters: TransactionFilters = { type, categoryId, accountId, from, to, query }
    return this.transactionsService.exportCsv(user.id, filters)
  }

  @Get('export/pdf')
  @HttpCode(200)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="transactions.pdf"')
  async exportPdf(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: string,
    @Query('categoryId') categoryId?: string,
    @Query('accountId') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('query') query?: string,
  ): Promise<StreamableFile> {
    const filters: TransactionFilters = { type, categoryId, accountId, from, to, query }
    const buffer = await this.transactionsService.exportPdf(user.id, filters)
    return new StreamableFile(buffer)
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TransactionResponse> {
    return transactionToResponse(await this.transactionsService.get(user.id, id))
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponse> {
    return transactionToResponse(await this.transactionsService.update(user.id, id, dto))
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    await this.transactionsService.remove(user.id, id)
  }
}
