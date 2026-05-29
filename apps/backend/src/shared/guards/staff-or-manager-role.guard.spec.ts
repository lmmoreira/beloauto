import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { StaffOrManagerRoleGuard } from './staff-or-manager-role.guard';

function makeContext(actorRole: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-actor-role': actorRole } }),
    }),
  } as unknown as ExecutionContext;
}

describe('StaffOrManagerRoleGuard', () => {
  const guard = new StaffOrManagerRoleGuard();

  it('returns true when X-Actor-Role is STAFF', () => {
    expect(guard.canActivate(makeContext('STAFF'))).toBe(true);
  });

  it('returns true when X-Actor-Role is MANAGER', () => {
    expect(guard.canActivate(makeContext('MANAGER'))).toBe(true);
  });

  it('throws 403 when X-Actor-Role is CUSTOMER', () => {
    expect(() => guard.canActivate(makeContext('CUSTOMER'))).toThrow(HttpException);
    try {
      guard.canActivate(makeContext('CUSTOMER'));
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      const body = (e as HttpException).getResponse() as Record<string, unknown>;
      expect(body['title']).toBe('Forbidden');
      expect(body['detail']).toBe('MANAGER or STAFF role required');
    }
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
