import { StaffBuilder } from '../../../../test/builders/staff';
import { InMemoryStaffRepository } from '../../../../test/repositories/staff/in-memory-staff.repository';
import {
  StaffAlreadyActiveError,
  StaffEmailMismatchError,
  StaffNotFoundError,
} from '../../domain/errors/staff-domain.error';
import { ActivateStaffUseCase } from './activate-staff.use-case';

describe('ActivateStaffUseCase', () => {
  let repo: InMemoryStaffRepository;
  let useCase: ActivateStaffUseCase;

  beforeEach(() => {
    repo = new InMemoryStaffRepository();
    useCase = new ActivateStaffUseCase(repo);
  });

  it('throws StaffNotFoundError when staffId does not exist in the tenant', async () => {
    await expect(
      useCase.execute('non-existent', {
        tenantId: '10000000-0000-4000-8000-000000000001',
        googleOAuthId: 'google-sub-123',
        email: 'staff@lavacar.com.br',
        name: 'Staff User',
      }),
    ).rejects.toThrow(StaffNotFoundError);
  });

  it('throws StaffNotFoundError when staffId exists but in a different tenant (isolation)', async () => {
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000001')
      .withEmail('staff@lavacar.com.br')
      .build();
    await repo.save(staff);

    await expect(
      useCase.execute(staff.id, {
        tenantId: '10000000-0000-4000-8000-000000000002',
        googleOAuthId: 'google-sub-123',
        email: 'staff@lavacar.com.br',
        name: 'Staff User',
      }),
    ).rejects.toThrow(StaffNotFoundError);
  });

  it('throws StaffAlreadyActiveError when staff is already active', async () => {
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000001')
      .withEmail('staff@lavacar.com.br')
      .withGoogleOAuthId('google-sub-already')
      .build();
    await repo.save(staff);

    await expect(
      useCase.execute(staff.id, {
        tenantId: '10000000-0000-4000-8000-000000000001',
        googleOAuthId: 'google-sub-new',
        email: 'staff@lavacar.com.br',
        name: 'Staff User',
      }),
    ).rejects.toThrow(StaffAlreadyActiveError);
  });

  it('throws StaffEmailMismatchError when Google email does not match invited email', async () => {
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000001')
      .withEmail('invited@lavacar.com.br')
      .build();
    await repo.save(staff);

    await expect(
      useCase.execute(staff.id, {
        tenantId: '10000000-0000-4000-8000-000000000001',
        googleOAuthId: 'google-sub-123',
        email: 'different@gmail.com',
        name: 'Staff User',
      }),
    ).rejects.toThrow(StaffEmailMismatchError);
  });

  it('activates the staff, persists name, and returns the result', async () => {
    const staff = new StaffBuilder()
      .withTenantId('10000000-0000-4000-8000-000000000001')
      .withEmail('gerente@lavacar.com.br')
      .withRole('MANAGER')
      .build();
    await repo.save(staff);

    const result = await useCase.execute(staff.id, {
      tenantId: '10000000-0000-4000-8000-000000000001',
      googleOAuthId: 'google-sub-new',
      email: 'gerente@lavacar.com.br',
      name: 'Gerente Silva',
    });

    expect(result.staffId).toBe(staff.id);
    expect(result.isActive).toBe(true);
    expect(result.role).toBe('MANAGER');

    const saved = await repo.findById(staff.id, '10000000-0000-4000-8000-000000000001');
    expect(saved!.isActive).toBe(true);
    expect(saved!.googleOAuthId).toBe('google-sub-new');
    expect(saved!.name).toBe('Gerente Silva');
  });
});
