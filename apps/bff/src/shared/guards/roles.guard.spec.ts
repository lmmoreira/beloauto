import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { RolesGuard } from './roles.guard';

function makeContext(user: CurrentUserPayload | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const customer: CurrentUserPayload = {
    sub: 'uuid-1',
    tenantId: 'tenant-1',
    tenantSlug: 'slug-1',
    role: 'CUSTOMER',
  };
  const staff: CurrentUserPayload = { ...customer, role: 'STAFF' };
  const manager: CurrentUserPayload = { ...customer, role: 'MANAGER' };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('returns true when no @Roles() metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext(customer))).toBe(true);
  });

  it('returns true when @Roles() is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(makeContext(customer))).toBe(true);
  });

  it('returns true when user role matches required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MANAGER']);
    expect(guard.canActivate(makeContext(manager))).toBe(true);
  });

  it('returns true when user role is one of multiple allowed roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['STAFF', 'MANAGER']);
    expect(guard.canActivate(makeContext(staff))).toBe(true);
  });

  it('throws 403 when STAFF tries to access a MANAGER-only endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MANAGER']);
    expect(() => guard.canActivate(makeContext(staff))).toThrow(HttpException);
    try {
      guard.canActivate(makeContext(staff));
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      const body = (e as HttpException).getResponse() as Record<string, unknown>;
      expect(body['status']).toBe(403);
    }
  });

  it('throws 403 when CUSTOMER tries to access a STAFF|MANAGER endpoint', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['STAFF', 'MANAGER']);
    expect(() => guard.canActivate(makeContext(customer))).toThrow(HttpException);
  });

  it('throws 403 when no user is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MANAGER']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(HttpException);
  });
});
