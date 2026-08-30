import { Controller, Get, Post, Body, Patch, Param, Delete, Request } from '@nestjs/common';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';

@Controller('recurring-transactions')
export class RecurringTransactionsController {
  constructor(private readonly recurringService: RecurringTransactionsService) {}

  @Post()
  create(@Request() req: any, @Body() createDto: CreateRecurringTransactionDto) {
    return this.recurringService.create(req.user.id, createDto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.recurringService.findAll(req.user.id);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() updateDto: UpdateRecurringTransactionDto) {
    return this.recurringService.update(req.user.id, id, updateDto);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.recurringService.remove(req.user.id, id);
  }
}
