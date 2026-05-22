import { Address, AddressProps } from '../../shared/value-objects/address';

const DEFAULT_ADDRESS: AddressProps = {
  street: 'Rua das Flores',
  number: '100',
  neighborhood: 'Centro',
  city: 'Belo Horizonte',
  state: 'MG',
  zipCode: '30100000',
};

// Returns a valid Brazilian Address for use in tests.
// Pass overrides to change specific fields without repeating the full object.
export function testAddress(overrides: Partial<AddressProps> = {}): Address {
  return Address.create({ ...DEFAULT_ADDRESS, ...overrides });
}
