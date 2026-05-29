import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ManagerRoleGuard } from './manager-role.guard';

function makeContext(actorRole: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-actor-role': actorRole } }),
    }),
  } as unknown as ExecutionContext;
}

describe('ManagerRoleGuard', () => {
  const guard = new ManagerRoleGuard();

  it('returns true when X-Actor-Role header is MANAGER', () => {
    expect(guard.canActivate(makeContext('MANAGER'))).toBe(true);
  });

  it('throws 403 when X-Actor-Role is STAFF', () => {
    expect(() => guard.canActivate(makeContext('STAFF'))).toThrow(HttpException);
    try {
      guard.canActivate(makeContext('STAFF'));
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      const body = (e as HttpException).getResponse() as Record<string, unknown>;
      expect(body['title']).toBe('Forbidden');
      expect(body['detail']).toBe('MANAGER role required');
    }
  });

  it('throws 403 when X-Actor-Role is CUSTOMER', () => {
    expect(() => guard.canActivate(makeContext('CUSTOMER'))).toThrow(HttpException);
  });

  it('throws 403 when X-Actor-Role header is absent', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(HttpException);
    try {
      guard.canActivate(makeContext(undefined));
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });
});
