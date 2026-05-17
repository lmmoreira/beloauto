import { Customer } from './customer.aggregate';
import { CustomerDomainError } from './errors/customer-domain.error';

describe('Customer', () => {
  const validArgs = ['tenant-1', 'google-sub-123', 'user@example.com', 'João Silva'] as const;

  it('creates a valid customer with correct defaults', () => {
    const c = Customer.create(...validArgs);
    expect(c.tenantId).toBe('tenant-1');
    expect(c.googleOAuthId).toBe('google-sub-123');
    expect(c.email).toBe('user@example.com');
    expect(c.name).toBe('João Silva');
    expect(c.phone).toBeNull();
    expect(c.defaultAddress).toBeNull();
    expect(c.id).toBeDefined();
  });

  it('throws when tenantId is empty', () => {
    expect(() => Customer.create('', 'sub', 'a@b.com', 'Nome')).toThrow(CustomerDomainError);
  });

  it('throws when googleOAuthId is empty', () => {
    expect(() => Customer.create('t1', '', 'a@b.com', 'Nome')).toThrow(CustomerDomainError);
  });

  it('throws when email is invalid', () => {
    expect(() => Customer.create('t1', 'sub', 'not-an-email', 'Nome')).toThrow(CustomerDomainError);
    expect(() => Customer.create('t1', 'sub', '@nodomain', 'Nome')).toThrow(CustomerDomainError);
    expect(() => Customer.create('t1', 'sub', 'no-at-sign', 'Nome')).toThrow(CustomerDomainError);
  });

  it('throws when name is empty', () => {
    expect(() => Customer.create('t1', 'sub', 'a@b.com', '')).toThrow(CustomerDomainError);
    expect(() => Customer.create('t1', 'sub', 'a@b.com', '   ')).toThrow(CustomerDomainError);
  });

  it('trims the name on create', () => {
    const c = Customer.create('t1', 'sub', 'a@b.com', '  Maria  ');
    expect(c.name).toBe('Maria');
  });

  it('multi-tenant: same googleOAuthId can create two separate Customer instances', () => {
    const c1 = Customer.create('tenant-a', 'same-sub', 'a@b.com', 'User');
    const c2 = Customer.create('tenant-b', 'same-sub', 'a@b.com', 'User');
    expect(c1.id).not.toBe(c2.id);
    expect(c1.tenantId).toBe('tenant-a');
    expect(c2.tenantId).toBe('tenant-b');
  });

  it('updateProfile updates name, phone, and address', () => {
    const c = Customer.create(...validArgs);
    c.updateProfile('Novo Nome', '(11) 99999-0000', { street: 'Rua A' });
    expect(c.name).toBe('Novo Nome');
    // PhoneNumber.create normalises to digits only
    expect(c.phone).toBe('11999990000');
    expect(c.defaultAddress).toEqual({ street: 'Rua A' });
  });

  it('updateProfile allows clearing phone and address with null', () => {
    const c = Customer.create(...validArgs);
    c.updateProfile('Novo Nome', null, null);
    expect(c.phone).toBeNull();
    expect(c.defaultAddress).toBeNull();
  });

  it('updateProfile throws when name is empty', () => {
    const c = Customer.create(...validArgs);
    expect(() => c.updateProfile('', null, null)).toThrow(CustomerDomainError);
  });

  it('updateProfile throws when phone is invalid', () => {
    const c = Customer.create(...validArgs);
    expect(() => c.updateProfile('Nome', '123', null)).toThrow(CustomerDomainError);
  });
});
