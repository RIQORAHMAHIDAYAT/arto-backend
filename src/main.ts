import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)
  const logger = new Logger('Bootstrap')

  app.setGlobalPrefix('api')
  app.use(helmet())

  const origins = (config.get<string>('CORS_ORIGINS', 'http://localhost:5173') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  app.enableCors({
    origin: origins.length === 1 && origins[0] === '*' ? true : origins,
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  )
  app.useGlobalFilters(new HttpExceptionFilter())

  const port = config.get<number>('PORT', 3000)
  await app.listen(port)
  logger.log(`ARTO backend berjalan di http://localhost:${port}/api`)
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})