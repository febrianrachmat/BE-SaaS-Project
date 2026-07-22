import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const started = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${method} ${originalUrl} ${res.statusCode} ${Date.now() - started}ms`,
          );
        },
        error: (error: Error & { status?: number }) => {
          const status = error.status ?? 500;
          this.logger.warn(
            `${method} ${originalUrl} ${status} ${Date.now() - started}ms — ${error.message}`,
          );
        },
      }),
    );
  }
}
