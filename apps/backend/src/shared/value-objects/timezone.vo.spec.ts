import { Timezone } from './timezone.vo';

describe('Timezone', () => {
  it('accepts valid IANA identifiers', () => {
    expect(Timezone.isValid('America/Sao_Paulo')).toBe(true);
    expect(Timezone.isValid('America/Manaus')).toBe(true);
    expect(Timezone.isValid('UTC')).toBe(true);
  });

  it('rejects invalid identifiers', () => {
    expect(Timezone.isValid('Not/AZone')).toBe(false);
    expect(Timezone.isValid('Brazil')).toBe(false);
    expect(Timezone.isValid('')).toBe(false);
  });

  it('create returns a Timezone for a valid value', () => {
    const tz = Timezone.create('America/Sao_Paulo');
    expect(tz.value).toBe('America/Sao_Paulo');
    expect(tz.toString()).toBe('America/Sao_Paulo');
  });

  it('create throws for an invalid value', () => {
    expect(() => Timezone.create('Not/AZone')).toThrow();
  });
});
