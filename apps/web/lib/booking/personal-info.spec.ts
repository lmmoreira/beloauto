import { describe, expect, it } from 'vitest';
import { emptyAddress, emptyPersonalInfo, isAddressFilled } from './personal-info';

describe('emptyAddress', () => {
  it('returns an address with all fields empty', () => {
    expect(emptyAddress()).toEqual({
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
    });
  });
});

describe('emptyPersonalInfo', () => {
  it('returns blank contact fields, empty addresses and no photos', () => {
    const value = emptyPersonalInfo();

    expect(value.contactName).toBe('');
    expect(value.contactEmail).toBe('');
    expect(value.contactPhone).toBe('');
    expect(value.contactAddress).toEqual(emptyAddress());
    expect(value.pickupAddress).toEqual(emptyAddress());
    expect(value.photoFilePaths).toEqual([]);
  });
});

describe('isAddressFilled', () => {
  it('returns false when any required field is empty', () => {
    expect(isAddressFilled(emptyAddress())).toBe(false);
  });

  it('returns true when all required fields are filled', () => {
    expect(
      isAddressFilled({
        street: 'Avenida Paulista',
        number: '1000',
        complement: '',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310100',
      }),
    ).toBe(true);
  });

  it('treats an empty complement as filled (complement is optional)', () => {
    expect(
      isAddressFilled({
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310100',
      }),
    ).toBe(true);
  });
});
