import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Response } from 'express'

export interface ApiErrorBody {
  statusCode: number
  message: string | string[]
  code?: string
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()

    const body = this.toBody(exception)

    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception))
    }

    response.status(body.statusCode).json(body)
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const raw = exception.getResponse()
      if (typeof raw === 'string') return { statusCode: status, message: raw }
      if (typeof raw === 'object' && raw !== null) {
        const record = raw as { message?: string | string[]; code?: string; error?: string }
        const message = record.message ?? exception.message
        const code = record.code ?? record.error
        return { statusCode: status, message, code }
      }
      return { statusCode: status, message: exception.message }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: 409, message: 'Data sudah ada.', code: 'CONFLICT' }
      }
      if (exception.code === 'P2003') {
        return { statusCode: 409, message: 'Data masih dipakai dan tidak dapat diubah.', code: 'CONFLICT' }
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Terjadi kesalahan pada server.',
      code: 'INTERNAL_ERROR',
    }
  }
}
