import { Controller, Get } from '@nestjs/common'
import { Public } from './common/decorators/public.decorator'

@Controller('health')
export class AppController {
  @Public()
  @Get()
  health(): { status: string; service: string; time: string } {
    return { status: 'ok', service: 'arto-backend', time: new Date().toISOString() }
  }
}