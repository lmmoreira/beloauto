import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { JwtIssuerService, JwtPayload } from './jwt-issuer.service';

const TEST_SECRET = 'test-secret-that-is-at-least-64-characters-long-for-jwt-signing!!';

describe('JwtIssuerService', () => {
  let service: JwtIssuerService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '7d' },
        }),
      ],
      providers: [JwtIssuerService],
    }).compile();

    service = moduleRef.get(JwtIssuerService);
    jwtService = moduleRef.get(JwtService);
  });

  it('issueToken() returns a JWT string', () => {
    const token = service.issueToken(
      'customer-uuid-1',
      'tenant-uuid-1',
      'lavacar-belo',
      'CUSTOMER',
    );
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('issued token decodes to the correct payload structure', () => {
    const sub = 'customer-uuid-abc';
    const tenantId = 'tenant-uuid-xyz';
    const tenantSlug = 'lavacar-belo';
    const role = 'CUSTOMER' as const;

    const token = service.issueToken(sub, tenantId, tenantSlug, role);
    const payload = jwtService.verify<JwtPayload & { iat: number; exp: number }>(token);

    expect(payload.sub).toBe(sub);
    expect(payload.tenantId).toBe(tenantId);
    expect(payload.tenantSlug).toBe(tenantSlug);
    expect(payload.role).toBe(role);
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('sub is the backend entity UUID — not a Google OAuth sub', () => {
    const backendUuid = '01961234-abcd-7000-8000-000000000001';
    const token = service.issueToken(backendUuid, 'tenant-1', 'slug-1', 'STAFF');
    const payload = jwtService.verify<JwtPayload>(token);

    expect(payload.sub).toBe(backendUuid);
  });

  it('issues tokens for all three roles', () => {
    for (const role of ['CUSTOMER', 'STAFF', 'MANAGER'] as const) {
      const token = service.issueToken('uuid-1', 'tenant-1', 'slug-1', role);
      const payload = jwtService.verify<JwtPayload>(token);
      expect(payload.role).toBe(role);
    }
  });

  it('token expires in ~7 days', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = service.issueToken('uuid-1', 'tenant-1', 'slug-1', 'MANAGER');
    const payload = jwtService.verify<JwtPayload & { iat: number; exp: number }>(token);
    const after = Math.floor(Date.now() / 1000);

    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    expect(payload.exp - payload.iat).toBe(sevenDaysInSeconds);
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDaysInSeconds);
    expect(payload.exp).toBeLessThanOrEqual(after + sevenDaysInSeconds);
  });

  it('a token with a tampered signature fails verification', () => {
    const token = service.issueToken('uuid-1', 'tenant-1', 'slug-1', 'CUSTOMER');
    const [header, payload] = token.split('.');
    const tamperedToken = `${header}.${payload}.invalidsignature`;

    expect(() => jwtService.verify(tamperedToken)).toThrow();
  });

  it('a token signed with a different secret fails verification', () => {
    const token = service.issueToken('uuid-1', 'tenant-1', 'slug-1', 'CUSTOMER');

    expect(() =>
      jwtService.verify(token, {
        secret: 'completely-different-secret-64-chars-longggggggggggggggg',
      }),
    ).toThrow();
  });
});
