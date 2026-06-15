import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HotsiteManifestResponse } from '@beloauto/types';
import { SITE_URL, buildHotsiteMetadata, buildLocalBusinessJsonLd } from './seo';

function makeManifest(overrides: Partial<HotsiteManifestResponse> = {}): HotsiteManifestResponse {
  return {
    tenant: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Lavacar BH',
      slug: 'lavacar-bh',
    },
    branding: {
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
    },
    layout: [],
    isPublished: true,
    business: {
      phone: null,
      email: null,
      address: null,
      socialLinks: null,
    },
    ...overrides,
  };
}

describe('SITE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('falls back to http://localhost:3000 when NEXT_PUBLIC_SITE_URL is unset', () => {
    expect(SITE_URL).toBe('http://localhost:3000');
  });

  it('reads NEXT_PUBLIC_SITE_URL when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://beloauto.com');
    vi.resetModules();

    const { SITE_URL: stubbedSiteUrl } = await import('./seo');

    expect(stubbedSiteUrl).toBe('https://beloauto.com');
  });
});

describe('buildHotsiteMetadata', () => {
  it('builds title, description, canonical, and Open Graph from the manifest', () => {
    const manifest = makeManifest();

    const metadata = buildHotsiteMetadata({ manifest, slug: 'lavacar-bh' });

    expect(metadata.title).toBe('Lavacar BH — Agendamento Online');
    expect(metadata.description).toBe('Agende seu serviço na Lavacar BH. Rápido, fácil e online.');
    expect(metadata.alternates).toEqual({ canonical: `${SITE_URL}/lavacar-bh` });
    expect(metadata.openGraph).toMatchObject({
      title: 'Lavacar BH — Agendamento Online',
      description: 'Agende seu serviço na Lavacar BH. Rápido, fácil e online.',
      url: `${SITE_URL}/lavacar-bh`,
      siteName: 'BeloAuto',
      locale: 'pt_BR',
      type: 'website',
    });
  });

  it('appends path to the canonical and Open Graph URL when provided', () => {
    const manifest = makeManifest();

    const metadata = buildHotsiteMetadata({ manifest, slug: 'lavacar-bh', path: '/booking' });

    expect(metadata.alternates).toEqual({ canonical: `${SITE_URL}/lavacar-bh/booking` });
    expect(metadata.openGraph).toMatchObject({ url: `${SITE_URL}/lavacar-bh/booking` });
  });

  it('sets robots to index/follow when the hotsite is published', () => {
    const manifest = makeManifest({ isPublished: true });

    const metadata = buildHotsiteMetadata({ manifest, slug: 'lavacar-bh' });

    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it('sets robots to noindex/nofollow when the hotsite is not published', () => {
    const manifest = makeManifest({ isPublished: false });

    const metadata = buildHotsiteMetadata({ manifest, slug: 'lavacar-bh' });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('includes the branding logo as a sized Open Graph image when present', () => {
    const manifest = makeManifest({
      branding: { ...makeManifest().branding, logoUrl: 'https://cdn.example.com/logo.png' },
    });

    const metadata = buildHotsiteMetadata({ manifest, slug: 'lavacar-bh' });

    expect(metadata.openGraph?.images).toEqual([
      { url: 'https://cdn.example.com/logo.png', width: 1200, height: 630 },
    ]);
  });

  it('returns an empty Open Graph images array when there is no logo', () => {
    const manifest = makeManifest();

    const metadata = buildHotsiteMetadata({ manifest, slug: 'lavacar-bh' });

    expect(metadata.openGraph?.images).toEqual([]);
  });
});

describe('buildLocalBusinessJsonLd', () => {
  it('builds a LocalBusiness entry with the tenant name and canonical URL', () => {
    const manifest = makeManifest();

    const jsonLd = buildLocalBusinessJsonLd({ manifest, slug: 'lavacar-bh' });

    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Lavacar BH',
      url: `${SITE_URL}/lavacar-bh`,
    });
  });
});
