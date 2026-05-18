import { Staff, StaffRole } from '../../../contexts/staff/domain/staff.aggregate';

export class StaffBuilder {
  private tenantId = 'tenant-id-1';
  private email = 'staff@example.com';
  private role: StaffRole = 'STAFF';
  private googleOAuthId: string | null = null;

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withEmail(email: string): this {
    this.email = email;
    return this;
  }

  withRole(role: StaffRole): this {
    this.role = role;
    return this;
  }

  withGoogleOAuthId(googleOAuthId: string): this {
    this.googleOAuthId = googleOAuthId;
    return this;
  }

  build(): Staff {
    const staff = Staff.invite(this.tenantId, this.email, this.role);
    if (this.googleOAuthId) {
      staff.activate(this.googleOAuthId);
    }
    return staff;
  }
}
