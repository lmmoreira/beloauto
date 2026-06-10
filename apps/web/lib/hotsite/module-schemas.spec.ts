import { describe, expect, it } from 'vitest';
import {
  HeroModuleDataSchema,
  ServiceListModuleDataSchema,
  isValidModuleData,
} from './module-schemas';

const validHeroData = {
  variant: 'centered',
  title: 'Bem-vindo à Lavacar',
  ctaLabel: 'Agendar agora',
  ctaTarget: 'booking',
};

const validServiceListData = {
  showPrices: true,
  showPoints: true,
  layout: 'grid',
};

describe('HeroModuleDataSchema', () => {
  it('accepts the minimal required fields', () => {
    expect(HeroModuleDataSchema.safeParse(validHeroData).success).toBe(true);
  });

  it('accepts optional subtitle and backgroundImageUrl', () => {
    const result = HeroModuleDataSchema.safeParse({
      ...validHeroData,
      subtitle: 'O melhor serviço da cidade',
      backgroundImageUrl: 'https://storage.example.com/hero.jpg',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid variant', () => {
    const result = HeroModuleDataSchema.safeParse({ ...validHeroData, variant: 'invalid' });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid ctaTarget', () => {
    const result = HeroModuleDataSchema.safeParse({ ...validHeroData, ctaTarget: 'invalid' });

    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = HeroModuleDataSchema.safeParse({ variant: 'centered', ctaTarget: 'booking' });

    expect(result.success).toBe(false);
  });
});

describe('ServiceListModuleDataSchema', () => {
  it('accepts the required fields', () => {
    expect(ServiceListModuleDataSchema.safeParse(validServiceListData).success).toBe(true);
  });

  it('accepts an optional title', () => {
    const result = ServiceListModuleDataSchema.safeParse({
      ...validServiceListData,
      title: 'Nossos Serviços',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid layout', () => {
    const result = ServiceListModuleDataSchema.safeParse({
      ...validServiceListData,
      layout: 'invalid',
    });

    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = ServiceListModuleDataSchema.safeParse({ layout: 'grid' });

    expect(result.success).toBe(false);
  });
});

describe('isValidModuleData', () => {
  it('returns true for valid HERO data', () => {
    expect(isValidModuleData('HERO', validHeroData)).toBe(true);
  });

  it('returns false for invalid HERO data', () => {
    expect(isValidModuleData('HERO', { variant: 'centered' })).toBe(false);
  });

  it('returns true for valid SERVICE_LIST data', () => {
    expect(isValidModuleData('SERVICE_LIST', validServiceListData)).toBe(true);
  });

  it('returns false for invalid SERVICE_LIST data', () => {
    expect(isValidModuleData('SERVICE_LIST', { layout: 'grid' })).toBe(false);
  });

  it('returns true for module types without a registered schema', () => {
    expect(isValidModuleData('GALLERY', { anything: 'goes' })).toBe(true);
  });
});
