import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  data: null;
  meta: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse) {
        const body = exceptionResponse as Record<string, unknown>;
        message =
          (typeof body.message === 'string'
            ? body.message
            : Array.isArray(body.message)
              ? body.message.join(', ')
              : exception.message) || message;
        code =
          typeof body.error === 'string'
            ? body.error.toUpperCase().replace(/\s+/g, '_')
            : HttpStatus[status] || code;
        details = body.message;
      }

      code = HttpStatus[status] ?? code;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `${request.method} ${request.url} — ${exception.message}`,
        exception.stack,
      );
    }

    const body: ErrorBody = {
      success: false,
      data: null,
      meta: null,
      error: {
        code,
        message,
        ...(process.env.NODE_ENV !== 'production' && details
          ? { details }
          : {}),
      },
    };

    response.status(status).json(body);
  }
}
