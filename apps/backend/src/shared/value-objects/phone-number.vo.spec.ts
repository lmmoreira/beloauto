import { PhoneNumber } from './phone-number.vo';

describe('PhoneNumber', () => {
  it('accepts 11-digit mobile numbers', () => {
    expect(PhoneNumber.isValid('11999990000')).toBe(true);
    expect(PhoneNumber.isValid('(11) 99999-0000')).toBe(true);
  });

  it('accepts 10-digit landline numbers', () => {
    expect(PhoneNumber.isValid('1133330000')).toBe(true);
    expect(PhoneNumber.isValid('(11) 3333-0000')).toBe(true);
  });

  it('rejects too few digits', () => {
    expect(PhoneNumber.isValid('11999')).toBe(false);
    expect(PhoneNumber.isValid('')).toBe(false);
  });

  it('rejects too many digits', () => {
    expect(PhoneNumber.isValid('119999900001')).toBe(false);
  });

  it('create normalises to digits only', () => {
    const p = PhoneNumber.create('(11) 99999-0000');
    expect(p.value).toBe('11999990000');
  });

  it('format returns (XX) XXXXX-XXXX for mobile', () => {
    const p = PhoneNumber.create('11999990000');
    expect(p.format()).toBe('(11) 99999-0000');
  });

  it('format returns (XX) XXXX-XXXX for landline', () => {
    const p = PhoneNumber.create('1133330000');
    expect(p.format()).toBe('(11) 3333-0000');
  });

  it('create throws for invalid input', () => {
    expect(() => PhoneNumber.create('123')).toThrow();
  });
});
