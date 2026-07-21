import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown> | null;
  error: null;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data: T | { data: T; meta?: Record<string, unknown> }) => {
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          !Array.isArray(data)
        ) {
          const wrapped = data as { data: T; meta?: Record<string, unknown> };
          return {
            success: true as const,
            data: wrapped.data,
            meta: wrapped.meta ?? null,
            error: null,
          };
        }

        return {
          success: true as const,
          data: data as T,
          meta: null,
          error: null,
        };
      }),
    );
  }
}
