import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecurringFrequency } from '@prisma/client';

@Injectable()
export class RecurringTransactionsService {
  private readonly logger = new Logger(RecurringTransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processRecurringTransactions() {
    this.logger.log('Mulai memproses transaksi rutin...');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeRecurring = await this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        nextRunDate: { lte: today },
        OR: [
          { endDate: null },
          { endDate: { gte: today } }
        ]
      }
    });

    if (activeRecurring.length === 0) {
      this.logger.log('Tidak ada transaksi rutin yang perlu diproses hari ini.');
      return;
    }

    let successCount = 0;
    for (const rec of activeRecurring) {
      try {
        // 1. Buat transaksi baru
        await this.prisma.transaction.create({
          data: {
            userId: rec.userId,
            accountId: rec.accountId,
            categoryId: rec.categoryId,
            type: rec.type,
            amount: rec.amount,
            transactionDate: today,
            note: rec.note ? `(Otomatis) ${rec.note}` : '(Otomatis) Transaksi Rutin',
          }
        });

        // 2. Tentukan nextRunDate
        let nextDate = new Date(rec.nextRunDate);
        if (rec.frequency === RecurringFrequency.daily) nextDate.setDate(nextDate.getDate() + 1);
        else if (rec.frequency === RecurringFrequency.weekly) nextDate.setDate(nextDate.getDate() + 7);
        else if (rec.frequency === RecurringFrequency.monthly) nextDate.setMonth(nextDate.getMonth() + 1);
        else if (rec.frequency === RecurringFrequency.yearly) nextDate.setFullYear(nextDate.getFullYear() + 1);

        // Jika endDate sudah terlewat untuk putaran berikutnya, nonaktifkan
        let willBeActive = true;
        if (rec.endDate && nextDate > rec.endDate) {
          willBeActive = false;
        }

        // 3. Update nextRunDate & isActive
        await this.prisma.recurringTransaction.update({
          where: { id: rec.id },
          data: {
            nextRunDate: nextDate,
            isActive: willBeActive
          }
        });
        
        // 4. Send notification
        await this.notificationsService.sendToUser(
          rec.userId, 
          'Pencatatan Otomatis Berhasil', 
          `Transaksi rutin untuk Rp ${rec.amount} berhasil dicatat.`
        );

        successCount++;
      } catch (err) {
        this.logger.error(`Gagal memproses transaksi rutin ID ${rec.id}`, err);
      }
    }

    this.logger.log(`Selesai memproses transaksi rutin. Berhasil: ${successCount}/${activeRecurring.length}`);
  }

  async create(userId: string, data: import('./dto/create-recurring-transaction.dto').CreateRecurringTransactionDto) {
    let nextRunDate = new Date(data.startDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Pastikan nextRunDate minimal adalah besok, karena hari ini diproses secara manual atau lewat cron besok
    if (nextRunDate <= today) {
      if (data.frequency === RecurringFrequency.daily) nextRunDate.setDate(today.getDate() + 1);
      else if (data.frequency === RecurringFrequency.weekly) nextRunDate.setDate(today.getDate() + 7);
      else if (data.frequency === RecurringFrequency.monthly) nextRunDate.setMonth(today.getMonth() + 1);
      else if (data.frequency === RecurringFrequency.yearly) nextRunDate.setFullYear(today.getFullYear() + 1);
    }

    return this.prisma.recurringTransaction.create({
      data: {
        userId,
        accountId: data.accountId,
        categoryId: data.categoryId,
        type: data.type,
        amount: data.amount,
        frequency: data.frequency,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        nextRunDate,
        note: data.note,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        account: true,
        category: true,
      }
    });
  }

  async update(userId: string, id: string, data: import('./dto/update-recurring-transaction.dto').UpdateRecurringTransactionDto) {
    const existing = await this.prisma.recurringTransaction.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Recurring transaction not found');
    
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.recurringTransaction.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Recurring transaction not found');

    return this.prisma.recurringTransaction.delete({ where: { id } });
  }
}
