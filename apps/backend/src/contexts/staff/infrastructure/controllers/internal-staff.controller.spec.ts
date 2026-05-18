import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { StaffBuilder } from '../../../../test/builders/staff';
import { InMemoryStaffRepository } from '../../../../test/repositories/staff/in-memory-staff.repository';
import { GetStaffByOAuthIdUseCase } from '../../application/use-cases/get-staff-by-oauth-id.use-case';
import { InternalStaffController } from './internal-staff.controller';

describe('InternalStaffController', () => {
  let repo: InMemoryStaffRepository;
  let controller: InternalStaffController;

  beforeEach(() => {
    repo = new InMemoryStaffRepository();
    controller = new InternalStaffController(new GetStaffByOAuthIdUseCase(repo));
  });

  describe('getByOAuth()', () => {
    it('throws BadRequestException when googleOAuthId is missing', async () => {
      await expect(controller.getByOAuth('')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps StaffNotFoundError to 404 when no staff is found', async () => {
      const err = await controller.getByOAuth('unknown-sub').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('returns StaffAuthInfo for an active staff member', async () => {
      const staff = new StaffBuilder()
        .withTenantId('10000000-0000-4000-8000-000000000001')
        .withRole('MANAGER')
        .withGoogleOAuthId('google-sub-test')
        .build();
      await repo.save(staff);

      const result = await controller.getByOAuth('google-sub-test');

      expect(result.staffId).toBe(staff.id);
      expect(result.tenantId).toBe('10000000-0000-4000-8000-000000000001');
      expect(result.role).toBe('MANAGER');
      expect(result.isActive).toBe(true);
    });

    it('returns isActive=false for a deactivated staff member', async () => {
      const staff = new StaffBuilder()
        .withTenantId('10000000-0000-4000-8000-000000000002')
        .withRole('STAFF')
        .withGoogleOAuthId('google-sub-inactive')
        .build();
      staff.deactivate();
      await repo.save(staff);

      const result = await controller.getByOAuth('google-sub-inactive');

      expect(result.isActive).toBe(false);
    });
  });
});
