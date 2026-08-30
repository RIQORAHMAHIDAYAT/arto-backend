import { Controller, Post, Body, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  pushToken: string;

  @IsString()
  @IsNotEmpty()
  platform: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-device')
  async registerDevice(@Request() req: any, @Body() body: RegisterDeviceDto) {
    await this.notificationsService.registerToken(req.user.id, body.pushToken, body.platform);
    return { success: true };
  }
}
