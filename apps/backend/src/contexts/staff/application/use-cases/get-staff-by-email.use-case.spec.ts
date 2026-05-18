import { StaffBuilder } from '../../../../test/builders/staff';
import { InMemoryStaffRepository } from '../../../../test/repositories/staff/in-memory-staff.repository';
import { GetStaffByEmailUseCase } from './get-staff-by-email.use-case';

describe('GetStaffByEmailUseCase', () => {
  let repo: InMemoryStaffRepository;
  let useCase: GetStaffByEmailUseCase;

  beforeEach(() => {
    repo = new InMemoryStaffRepository();
    useCase = new GetStaffByEmailUseCase(repo);
  });

  it('returns null when no staff exists for the given email + tenantId', async () => {
    const result = await useCase.execute(
      'unknown@lavacar.com.br',
      '10000000-0000-4000-8000-000000000001',
    );
    expect(result).toBeNull();
  });

  it('returns null when staff exists but in a different tenant (isolation)', async () => {
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000001')
      .withEmail('staff@lavacar.com.br')
      .build();
    await repo.save(staff);

    const result = await useCase.execute(
      'staff@lavacar.com.br',
      '10000000-0000-4000-8000-000000000002',
    );
    expect(result).toBeNull();
  });

  it('returns StaffByEmailInfo for an invited (inactive) staff member', async () => {
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000001')
      .withEmail('gerente@lavacar.com.br')
      .withRole('MANAGER')
      .build();
    await repo.save(staff);

    const result = await useCase.execute(
      'gerente@lavacar.com.br',
      '10000000-0000-4000-8000-000000000001',
    );

    expect(result).not.toBeNull();
    expect(result!.staffId).toBe(staff.id);
    expect(result!.email).toBe('gerente@lavacar.com.br');
    expect(result!.role).toBe('MANAGER');
    expect(result!.isActive).toBe(false);
  });

  it('returns isActive=true for an already-activated staff member', async () => {
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000001')
      .withEmail('staff@lavacar.com.br')
      .withGoogleOAuthId('google-sub-active')
      .build();
    await repo.save(staff);

    const result = await useCase.execute(
      'staff@lavacar.com.br',
      '10000000-0000-4000-8000-000000000001',
    );

    expect(result!.isActive).toBe(true);
  });
});
