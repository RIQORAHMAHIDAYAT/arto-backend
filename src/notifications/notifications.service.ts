import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  private expo = new Expo();
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, pushToken: string, platform: string) {
    if (!Expo.isExpoPushToken(pushToken)) {
      this.logger.warn(`Token tidak valid dari user ${userId}: ${pushToken}`);
      return;
    }

    await this.prisma.userDevice.upsert({
      where: { pushToken },
      create: { userId, pushToken, platform },
      update: { userId, platform },
    });
    this.logger.log(`Push token didaftarkan untuk user ${userId}`);
  }

  async sendToUser(userId: string, title: string, body: string, data?: any) {
    const devices = await this.prisma.userDevice.findMany({ where: { userId } });
    if (devices.length === 0) return;

    const messages: ExpoPushMessage[] = devices.map(device => ({
      to: device.pushToken,
      sound: 'default',
      title,
      body,
      data,
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        this.logger.log(`Push notification terkirim ke user ${userId}`);
      } catch (error) {
        this.logger.error(`Gagal mengirim notifikasi ke user ${userId}`, error);
      }
    }
  }
}
