import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

const TEST_KEY = 'a'.repeat(32);

const makeContext = (authHeader?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: authHeader ? { authorization: authHeader } : {} }),
    }),
  }) as unknown as ExecutionContext;

describe('PlatformAdminGuard', () => {
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    process.env['PLATFORM_ADMIN_KEY'] = TEST_KEY;
    guard = new PlatformAdminGuard();
  });

  afterEach(() => {
    delete process.env['PLATFORM_ADMIN_KEY'];
  });

  it('returns true for a valid Bearer token', () => {
    expect(guard.canActivate(makeContext(`Bearer ${TEST_KEY}`))).toBe(true);
  });

  it('throws 401 when Authorization header is absent', () => {
    expect(() => guard.canActivate(makeContext())).toThrow(UnauthorizedException);
  });

  it('throws 401 for a wrong key', () => {
    expect(() => guard.canActivate(makeContext('Bearer wrong-key-wrong-key-wrong-key'))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 for non-Bearer scheme', () => {
    expect(() => guard.canActivate(makeContext(`Basic ${TEST_KEY}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a key of different length without throwing — hash normalisation prevents length errors', () => {
    // timingSafeEqual requires equal-length buffers; hashing both sides guarantees this.
    // A short or long incoming token must not crash — it should just fail auth.
    expect(() => guard.canActivate(makeContext('Bearer short'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(makeContext(`Bearer ${'x'.repeat(64)}`))).toThrow(
      UnauthorizedException,
    );
  });
});
