import type { HotsiteBrandingResponse } from '@beloauto/types';
import { describe, expect, it } from 'vitest';

// next/font/google is aliased to __mocks__/next-font-google.ts in vitest.config.ts
import { applyBranding } from './apply-branding';

type CSSTokens = Record<string, string>;

function makeBranding(overrides?: Partial<HotsiteBrandingResponse>): HotsiteBrandingResponse {
  return {
    logoUrl: '',
    primaryColor: '#0055A4',
    secondaryColor: '#FFFFFF',
    backgroundColor: '#F5F5F5',
    textColor: '#111111',
    headingFontFamily: 'Inter',
    bodyFontFamily: 'Roboto',
    borderRadius: 'rounded',
    spacing: 'comfortable',
    shadowStyle: 'subtle',
    buttonStyle: 'filled',
    ...overrides,
  };
}

describe('applyBranding', () => {
  it('maps color tokens to CSS custom properties', () => {
    const result = applyBranding(makeBranding()) as CSSTokens;

    expect(result['--ba-primary']).toBe('#0055A4');
    expect(result['--ba-secondary']).toBe('#FFFFFF');
    expect(result['--ba-background']).toBe('#F5F5F5');
    expect(result['--ba-text']).toBe('#111111');
  });

  it('resolves heading and body font families to var() references', () => {
    const result = applyBranding(
      makeBranding({ headingFontFamily: 'Poppins', bodyFontFamily: 'Lato' }),
    ) as CSSTokens;

    expect(result['--ba-heading-font']).toBe('var(--font-poppins)');
    expect(result['--ba-body-font']).toBe('var(--font-lato)');
  });

  it('falls back to Inter when font family is not in the allow-list', () => {
    const result = applyBranding(makeBranding({ headingFontFamily: 'Comic Sans' })) as CSSTokens;

    expect(result['--ba-heading-font']).toBe('var(--font-inter)');
  });

  it('falls back to Inter for body font when family is not in the allow-list', () => {
    const result = applyBranding(makeBranding({ bodyFontFamily: 'Wingdings' })) as CSSTokens;

    expect(result['--ba-body-font']).toBe('var(--font-inter)');
  });

  it('maps border-radius variants correctly', () => {
    expect(
      (applyBranding(makeBranding({ borderRadius: 'sharp' })) as CSSTokens)['--ba-radius'],
    ).toBe('0px');
    expect(
      (applyBranding(makeBranding({ borderRadius: 'rounded' })) as CSSTokens)['--ba-radius'],
    ).toBe('8px');
    expect(
      (applyBranding(makeBranding({ borderRadius: 'pill' })) as CSSTokens)['--ba-radius'],
    ).toBe('9999px');
  });

  it('maps spacing variants to section padding tokens', () => {
    expect(
      (applyBranding(makeBranding({ spacing: 'compact' })) as CSSTokens)['--ba-section-py'],
    ).toBe('3rem');
    expect(
      (applyBranding(makeBranding({ spacing: 'comfortable' })) as CSSTokens)['--ba-section-py'],
    ).toBe('5rem');
    expect(
      (applyBranding(makeBranding({ spacing: 'spacious' })) as CSSTokens)['--ba-section-py'],
    ).toBe('8rem');
  });

  it('maps shadow style variants', () => {
    expect((applyBranding(makeBranding({ shadowStyle: 'none' })) as CSSTokens)['--ba-shadow']).toBe(
      'none',
    );
    expect(
      (applyBranding(makeBranding({ shadowStyle: 'subtle' })) as CSSTokens)['--ba-shadow'],
    ).toContain('rgba');
    expect(
      (applyBranding(makeBranding({ shadowStyle: 'strong' })) as CSSTokens)['--ba-shadow'],
    ).toContain('rgba');
  });

  it('passes button style through as-is', () => {
    const result = applyBranding(makeBranding({ buttonStyle: 'outline' })) as CSSTokens;

    expect(result['--ba-btn-variant']).toBe('outline');
  });

  it('derives filled button tokens: primary bg, white text, primary border', () => {
    const result = applyBranding(makeBranding({ buttonStyle: 'filled' })) as CSSTokens;

    expect(result['--ba-btn-bg']).toBe('var(--ba-primary)');
    expect(result['--ba-btn-text']).toBe('#ffffff');
    expect(result['--ba-btn-border']).toBe('var(--ba-primary)');
  });

  it('derives outline button tokens: transparent bg, primary text, primary border', () => {
    const result = applyBranding(makeBranding({ buttonStyle: 'outline' })) as CSSTokens;

    expect(result['--ba-btn-bg']).toBe('transparent');
    expect(result['--ba-btn-text']).toBe('var(--ba-primary)');
    expect(result['--ba-btn-border']).toBe('var(--ba-primary)');
  });

  it('derives ghost button tokens: transparent bg, primary text, transparent border', () => {
    const result = applyBranding(makeBranding({ buttonStyle: 'ghost' })) as CSSTokens;

    expect(result['--ba-btn-bg']).toBe('transparent');
    expect(result['--ba-btn-text']).toBe('var(--ba-primary)');
    expect(result['--ba-btn-border']).toBe('transparent');
  });

  it('derives --ba-hero-text from backgroundColor (contrast colour for primaryColor overlay)', () => {
    const result = applyBranding(makeBranding({ backgroundColor: '#FFFFFF' })) as CSSTokens;

    expect(result['--ba-hero-text']).toBe('#FFFFFF');
  });

  it('falls back to filled button style when buttonStyle is not a known variant', () => {
    const branding = makeBranding({ buttonStyle: 'unknown' as 'filled' });
    const result = applyBranding(branding) as CSSTokens;

    expect(result['--ba-btn-bg']).toBe('var(--ba-primary)');
    expect(result['--ba-btn-text']).toBe('#ffffff');
    expect(result['--ba-btn-border']).toBe('var(--ba-primary)');
  });
});
