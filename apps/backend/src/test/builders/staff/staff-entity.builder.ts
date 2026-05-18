import { StaffEntity } from '../../../contexts/staff/infrastructure/entities/staff.entity';

export class StaffEntityBuilder {
  private id = '00000000-0000-7000-8003-000000000001';
  private tenantId = '00000000-0000-7000-8000-000000000001';
  private googleOAuthId: string | null = null;
  private email = 'staff@example.com';
  private role = 'STAFF';
  private isActive = false;
  private readonly createdAt = new Date('2026-01-01T00:00:00Z');
  private readonly updatedAt = new Date('2026-01-01T00:00:00Z');

  withId(id: string): this {
    this.id = id;
    return this;
  }

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withGoogleOAuthId(googleOAuthId: string | null): this {
    this.googleOAuthId = googleOAuthId;
    return this;
  }

  withEmail(email: string): this {
    this.email = email;
    return this;
  }

  withRole(role: string): this {
    this.role = role;
    return this;
  }

  withIsActive(isActive: boolean): this {
    this.isActive = isActive;
    return this;
  }

  build(): StaffEntity {
    const e = new StaffEntity();
    e.id = this.id;
    e.tenantId = this.tenantId;
    e.googleOAuthId = this.googleOAuthId;
    e.email = this.email;
    e.role = this.role;
    e.isActive = this.isActive;
    e.createdAt = this.createdAt;
    e.updatedAt = this.updatedAt;
    return e;
  }
}
