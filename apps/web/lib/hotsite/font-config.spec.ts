import { describe, expect, it } from 'vitest';

// next/font/google is aliased to __mocks__/next-font-google.ts in vitest.config.ts
import { FONT_MAP, FONT_VARIABLES } from './font-config';

const SUPPORTED_FONTS = [
  'Inter',
  'Poppins',
  'Playfair Display',
  'Montserrat',
  'Raleway',
  'Oswald',
  'Lato',
  'Roboto',
];

describe('FONT_VARIABLES', () => {
  it('exports one CSS variable string per font', () => {
    expect(FONT_VARIABLES).toHaveLength(SUPPORTED_FONTS.length);
  });

  it('every entry is a CSS custom property string', () => {
    for (const v of FONT_VARIABLES) {
      expect(v).toMatch(/^--font-/);
    }
  });
});

describe('FONT_MAP', () => {
  it('contains an entry for every supported font', () => {
    for (const name of SUPPORTED_FONTS) {
      expect(FONT_MAP).toHaveProperty(name);
    }
  });

  it('values are var() references matching the variable name', () => {
    expect(FONT_MAP['Inter']).toBe('var(--font-inter)');
    expect(FONT_MAP['Playfair Display']).toBe('var(--font-playfair-display)');
    expect(FONT_MAP['Roboto']).toBe('var(--font-roboto)');
  });
});
