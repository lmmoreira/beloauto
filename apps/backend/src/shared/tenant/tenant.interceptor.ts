import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { uuidv7 } from '../domain/uuid-v7';
import { ProblemDetail } from '../http/problem-detail';
import { runWithTenantContext } from './tenant-context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      path: string;
    }>();

    if (req.path?.startsWith('/health') || req.path?.startsWith('/internal')) {
      return next.handle();
    }

    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      const body: ProblemDetail = {
        type: 'about:blank',
        title: 'Missing Tenant Header',
        status: HttpStatus.BAD_REQUEST,
        detail: 'X-Tenant-ID header is required on all requests',
      };
      throw new HttpException(body, HttpStatus.BAD_REQUEST);
    }

    const correlationId = req.headers['x-correlation-id'] ?? uuidv7();

    // Wrap the entire request observable in AsyncLocalStorage context so that
    // TenantContext.tenantId/correlationId are available anywhere in the call chain.
    return new Observable((subscriber) => {
      runWithTenantContext(tenantId, correlationId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
