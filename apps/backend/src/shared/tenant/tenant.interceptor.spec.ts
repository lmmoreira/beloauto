import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { lastValueFrom, Observable, of, Subscriber } from 'rxjs';
import { TenantContext } from './tenant-context';
import { TenantInterceptor } from './tenant.interceptor';

function makeContext(
  headers: Record<string, string | undefined>,
  path = '/api/resource',
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers, path }) }),
  } as unknown as ExecutionContext;
}

const mockCallHandler: CallHandler = { handle: () => of('result') };
const interceptor = new TenantInterceptor();

describe('TenantInterceptor', () => {
  it('throws 400 Problem Detail when X-Tenant-ID header is missing', () => {
    let caught: HttpException | null = null;
    try {
      interceptor.intercept(makeContext({}), mockCallHandler);
    } catch (e) {
      caught = e as HttpException;
    }

    expect(caught).toBeInstanceOf(HttpException);
    expect(caught!.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    const body = caught!.getResponse() as Record<string, unknown>;
    expect(body['status']).toBe(400);
    expect(body['title']).toBe('Missing Tenant Header');
  });

  it('makes tenantId and correlationId available inside the observable', async () => {
    const ctx = makeContext({ 'x-tenant-id': 'tid-1', 'x-correlation-id': 'corr-1' });
    const tenantContext = new TenantContext();

    let capturedTenantId: string | undefined;
    let capturedCorrelationId: string | undefined;

    const handler: CallHandler = {
      handle: () => {
        capturedTenantId = tenantContext.tenantId;
        capturedCorrelationId = tenantContext.correlationId;
        return of(null);
      },
    };

    await lastValueFrom(interceptor.intercept(ctx, handler));

    expect(capturedTenantId).toBe('tid-1');
    expect(capturedCorrelationId).toBe('corr-1');
  });

  it('generates correlationId when X-Correlation-ID is absent', async () => {
    const ctx = makeContext({ 'x-tenant-id': 'tid-1' });
    const tenantContext = new TenantContext();

    let capturedCorrelationId: string | undefined;
    const handler: CallHandler = {
      handle: () => {
        capturedCorrelationId = tenantContext.correlationId;
        return of(null);
      },
    };

    await lastValueFrom(interceptor.intercept(ctx, handler));

    expect(capturedCorrelationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('skips tenant check for health routes', () => {
    const ctx = makeContext({}, '/health/live');
    expect(() => interceptor.intercept(ctx, mockCallHandler)).not.toThrow();
  });

  it('concurrent requests store independent tenant contexts', async () => {
    const tenantContext = new TenantContext();
    const results: Array<{ tenantId: string; correlationId: string }> = [];

    const makeSlowHandler = (delay: number): CallHandler => ({
      handle: () =>
        new Observable((sub: Subscriber<null>) => {
          setTimeout(() => {
            results.push({
              tenantId: tenantContext.tenantId,
              correlationId: tenantContext.correlationId,
            });
            sub.next(null);
            sub.complete();
          }, delay);
        }),
    });

    await Promise.all([
      lastValueFrom(
        interceptor.intercept(
          makeContext({ 'x-tenant-id': 'tenant-a', 'x-correlation-id': 'corr-a' }),
          makeSlowHandler(20),
        ),
      ),
      lastValueFrom(
        interceptor.intercept(
          makeContext({ 'x-tenant-id': 'tenant-b', 'x-correlation-id': 'corr-b' }),
          makeSlowHandler(10),
        ),
      ),
    ]);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.tenantId === 'tenant-a')).toBeDefined();
    expect(results.find((r) => r.tenantId === 'tenant-b')).toBeDefined();
  });
});
