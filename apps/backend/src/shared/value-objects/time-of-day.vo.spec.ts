import { TimeOfDay } from './time-of-day.vo';

describe('TimeOfDay', () => {
  it('accepts valid HH:MM values', () => {
    expect(TimeOfDay.isValid('00:00')).toBe(true);
    expect(TimeOfDay.isValid('09:00')).toBe(true);
    expect(TimeOfDay.isValid('23:59')).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(TimeOfDay.isValid('9:00')).toBe(false);
    expect(TimeOfDay.isValid('09:0')).toBe(false);
    expect(TimeOfDay.isValid('24:00')).toBe(false);
    expect(TimeOfDay.isValid('12:60')).toBe(false);
    expect(TimeOfDay.isValid('')).toBe(false);
    expect(TimeOfDay.isValid('noon')).toBe(false);
  });

  it('create returns a TimeOfDay for a valid value', () => {
    const t = TimeOfDay.create('09:30');
    expect(t.value).toBe('09:30');
  });

  it('create throws for an invalid value', () => {
    expect(() => TimeOfDay.create('25:00')).toThrow();
  });

  it('isBefore returns correct comparison', () => {
    const open = TimeOfDay.create('09:00');
    const close = TimeOfDay.create('18:00');
    expect(open.isBefore(close)).toBe(true);
    expect(close.isBefore(open)).toBe(false);
  });
});
