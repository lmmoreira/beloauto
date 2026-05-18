import { Email } from '../../../shared/value-objects/email.vo';
import { Staff } from './staff.aggregate';
import { StaffDomainError } from './errors/staff-domain.error';

describe('Staff', () => {
  describe('invite()', () => {
    it('creates a staff member with isActive=false and null googleOAuthId', () => {
      const staff = Staff.invite('tenant-1', 'ana@lavacar.com.br', 'STAFF');
      expect(staff.tenantId).toBe('tenant-1');
      expect(staff.email).toBeInstanceOf(Email);
      expect(staff.email.address).toBe('ana@lavacar.com.br');
      expect(staff.role).toBe('STAFF');
      expect(staff.isActive).toBe(false);
      expect(staff.googleOAuthId).toBeNull();
      expect(staff.id).toBeDefined();
    });

    it('creates a MANAGER role staff member', () => {
      const staff = Staff.invite('tenant-1', 'gerente@lavacar.com.br', 'MANAGER');
      expect(staff.role).toBe('MANAGER');
      expect(staff.isActive).toBe(false);
    });

    it('throws when tenantId is empty', () => {
      expect(() => Staff.invite('', 'a@b.com', 'STAFF')).toThrow(StaffDomainError);
    });

    it('throws when email is invalid', () => {
      expect(() => Staff.invite('tenant-1', 'not-an-email', 'STAFF')).toThrow(StaffDomainError);
      expect(() => Staff.invite('tenant-1', '@nodomain', 'STAFF')).toThrow(StaffDomainError);
      expect(() => Staff.invite('tenant-1', 'no-at-sign', 'STAFF')).toThrow(StaffDomainError);
    });

    it('throws when role is invalid', () => {
      expect(() => Staff.invite('tenant-1', 'a@b.com', 'ADMIN' as never)).toThrow(StaffDomainError);
    });
  });

  describe('activate()', () => {
    it('sets googleOAuthId and isActive=true', () => {
      const staff = Staff.invite('tenant-1', 'ana@lavacar.com.br', 'STAFF');
      staff.activate('google-sub-456');
      expect(staff.googleOAuthId).toBe('google-sub-456');
      expect(staff.isActive).toBe(true);
    });

    it('throws when googleOAuthId is empty', () => {
      const staff = Staff.invite('tenant-1', 'ana@lavacar.com.br', 'STAFF');
      expect(() => staff.activate('')).toThrow(StaffDomainError);
    });
  });

  describe('deactivate()', () => {
    it('sets isActive=false', () => {
      const staff = Staff.invite('tenant-1', 'ana@lavacar.com.br', 'STAFF');
      staff.activate('google-sub-789');
      staff.deactivate();
      expect(staff.isActive).toBe(false);
    });
  });

  describe('single-tenant: same googleOAuthId in same tenant cannot create duplicate domain objects (DB enforces)', () => {
    it('two Staff instances with same googleOAuthId and tenantId are separate in-memory objects', () => {
      const s1 = Staff.invite('tenant-a', 'x@a.com', 'STAFF');
      const s2 = Staff.invite('tenant-a', 'y@a.com', 'MANAGER');
      s1.activate('same-sub');
      s2.activate('same-sub');
      expect(s1.id).not.toBe(s2.id);
      expect(s1.tenantId).toBe(s2.tenantId);
    });
  });
});
