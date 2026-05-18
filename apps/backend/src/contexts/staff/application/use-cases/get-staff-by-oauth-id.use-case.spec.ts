import { StaffBuilder } from '../../../../test/builders/staff';
import { InMemoryStaffRepository } from '../../../../test/repositories/staff/in-memory-staff.repository';
import { GetStaffByOAuthIdUseCase } from './get-staff-by-oauth-id.use-case';

function makeUseCase(repo = new InMemoryStaffRepository()) {
  return { useCase: new GetStaffByOAuthIdUseCase(repo), repo };
}

describe('GetStaffByOAuthIdUseCase', () => {
  it('returns null when no staff exists for the given googleOAuthId', async () => {
    const { useCase } = makeUseCase();
    expect(await useCase.execute('google-sub-unknown')).toBeNull();
  });

  it('returns StaffAuthInfo with correct fields for an active staff member', async () => {
    const { useCase, repo } = makeUseCase();
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000001')
      .withRole('MANAGER')
      .withGoogleOAuthId('google-sub-manager')
      .build();
    await repo.save(staff);

    const result = await useCase.execute('google-sub-manager');

    expect(result).not.toBeNull();
    expect(result!.staffId).toBe(staff.id);
    expect(result!.tenantId).toBe('10000000-0000-4000-8000-000000000001');
    expect(result!.role).toBe('MANAGER');
    expect(result!.isActive).toBe(true);
  });

  it('returns isActive=false for a deactivated staff member (still has googleOAuthId set)', async () => {
    const { useCase, repo } = makeUseCase();
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000002')
      .withRole('STAFF')
      .withGoogleOAuthId('google-sub-deactivated')
      .build();
    staff.deactivate();
    await repo.save(staff);

    const result = await useCase.execute('google-sub-deactivated');

    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(false);
    expect(result!.role).toBe('STAFF');
  });

  it('returns null for invited-but-not-yet-activated staff (googleOAuthId is null)', async () => {
    const { useCase, repo } = makeUseCase();
    const invited = new StaffBuilder().withTenantId('10000000-0000-4000-8000-000000000003').build();
    await repo.save(invited);

    expect(await useCase.execute('any-sub')).toBeNull();
  });
});
