import { Customer } from '../../../contexts/customer/domain/customer.aggregate';

export class CustomerBuilder {
  private tenantId = 'tenant-id-1';
  private googleOAuthId = 'google-sub-1';
  private email = 'customer@example.com';
  private name = 'João Silva';

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withGoogleOAuthId(googleOAuthId: string): this {
    this.googleOAuthId = googleOAuthId;
    return this;
  }

  withEmail(email: string): this {
    this.email = email;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  build(): Customer {
    return Customer.create(this.tenantId, this.googleOAuthId, this.email, this.name);
  }
}
