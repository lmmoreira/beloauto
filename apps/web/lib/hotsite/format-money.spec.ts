import { describe, expect, it } from 'vitest';
import { formatBRL } from './format-money';

describe('formatBRL', () => {
  it('formats whole reais with two decimal places', () => {
    expect(formatBRL(150)).toBe('R$ 150,00');
  });

  it('formats thousands with a dot separator', () => {
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50');
  });

  it('formats zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
  });
});
