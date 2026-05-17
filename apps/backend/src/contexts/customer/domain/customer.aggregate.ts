import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { uuidv7 } from '../../../shared/domain/uuid-v7';
import { Email } from '../../../shared/value-objects/email.vo';
import { PhoneNumber } from '../../../shared/value-objects/phone-number.vo';
import { CustomerDomainError } from './errors/customer-domain.error';

export interface CustomerProps {
  id: string;
  tenantId: string;
  googleOAuthId: string;
  email: string;
  name: string;
  phone: string | null;
  defaultAddress: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Customer extends AggregateRoot {
  private readonly props: CustomerProps;

  private constructor(props: CustomerProps) {
    super();
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get googleOAuthId(): string {
    return this.props.googleOAuthId;
  }
  get email(): string {
    return this.props.email;
  }
  get name(): string {
    return this.props.name;
  }
  get phone(): string | null {
    return this.props.phone;
  }
  get defaultAddress(): Record<string, unknown> | null {
    return this.props.defaultAddress;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static create(tenantId: string, googleOAuthId: string, email: string, name: string): Customer {
    if (!tenantId) throw new CustomerDomainError('tenantId is required');
    if (!googleOAuthId) throw new CustomerDomainError('googleOAuthId is required');
    if (!Email.isValid(email)) throw new CustomerDomainError('email must be a valid email address');
    if (!name || name.trim().length === 0) throw new CustomerDomainError('name must not be empty');

    const now = new Date();
    return new Customer({
      id: uuidv7(),
      tenantId,
      googleOAuthId,
      email,
      name: name.trim(),
      phone: null,
      defaultAddress: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  updateProfile(
    name: string,
    phone: string | null,
    defaultAddress: Record<string, unknown> | null,
  ): void {
    if (!name || name.trim().length === 0) throw new CustomerDomainError('name must not be empty');
    if (phone !== null && !PhoneNumber.isValid(phone)) {
      throw new CustomerDomainError(
        'phone must be a valid Brazilian phone number (10 or 11 digits)',
      );
    }
    this.props.name = name.trim();
    this.props.phone = phone === null ? null : PhoneNumber.create(phone).value;
    this.props.defaultAddress = defaultAddress;
    this.props.updatedAt = new Date();
  }
}
