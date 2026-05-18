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
      headers: Record<string, string | string[] | undefined>;
      path: string;
    }>();

    if (req.path?.startsWith('/health') || req.path?.startsWith('/internal')) {
      return next.handle();
    }

    const tenantId =
      typeof req.headers['x-tenant-id'] === 'string' ? req.headers['x-tenant-id'] : undefined;
    if (!tenantId) {
      const body: ProblemDetail = {
        type: 'about:blank',
        title: 'Missing Tenant Header',
        status: HttpStatus.BAD_REQUEST,
        detail: 'X-Tenant-ID header is required on all requests',
      };
      throw new HttpException(body, HttpStatus.BAD_REQUEST);
    }

    const correlationId =
      (typeof req.headers['x-correlation-id'] === 'string'
        ? req.headers['x-correlation-id']
        : undefined) ?? uuidv7();

    const actorId =
      typeof req.headers['x-actor-id'] === 'string' ? req.headers['x-actor-id'] : undefined;
    const rawActorType =
      typeof req.headers['x-actor-type'] === 'string' ? req.headers['x-actor-type'] : undefined;
    const actorType: 'STAFF' | 'CUSTOMER' | undefined =
      rawActorType === 'STAFF' || rawActorType === 'CUSTOMER' ? rawActorType : undefined;
    const actorRole =
      typeof req.headers['x-actor-role'] === 'string' ? req.headers['x-actor-role'] : undefined;
    const actor = actorId && actorType && actorRole ? { actorId, actorType, actorRole } : undefined;

    // Wrap the entire request observable in AsyncLocalStorage context so that
    // TenantContext fields are available anywhere in the call chain.
    return new Observable((subscriber) => {
      runWithTenantContext(
        tenantId,
        correlationId,
        () => {
          next.handle().subscribe(subscriber);
        },
        actor,
      );
    });
  }
}
