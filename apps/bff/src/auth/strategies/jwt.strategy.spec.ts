import { JwtStrategy } from './jwt.strategy';
import { CurrentUserPayload } from '../../shared/decorators/current-user.decorator';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    process.env['JWT_SECRET'] = 'test-secret-64-chars-longggggggggggggggggggggggggggggggggg!!';
    strategy = new JwtStrategy();
  });

  it('validate() returns the payload as-is to populate req.user', () => {
    const payload: CurrentUserPayload = {
      sub: 'customer-uuid-1',
      tenantId: 'tenant-uuid-1',
      tenantSlug: 'lavacar-belo',
      role: 'CUSTOMER',
    };

    const result = strategy.validate(payload);

    expect(result).toEqual(payload);
  });

  it('validate() works for STAFF role', () => {
    const payload: CurrentUserPayload = {
      sub: 'staff-uuid-1',
      tenantId: 'tenant-uuid-1',
      tenantSlug: 'lavacar-belo',
      role: 'STAFF',
    };

    expect(strategy.validate(payload)).toEqual(payload);
  });

  it('validate() works for MANAGER role', () => {
    const payload: CurrentUserPayload = {
      sub: 'manager-uuid-1',
      tenantId: 'tenant-uuid-1',
      tenantSlug: 'lavacar-belo',
      role: 'MANAGER',
    };

    expect(strategy.validate(payload)).toEqual(payload);
  });
});
