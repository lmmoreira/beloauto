import type { Metadata } from 'next';
import type { HotsiteManifestResponse } from '@beloauto/types';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export interface BuildHotsiteMetadataParams {
  readonly manifest: HotsiteManifestResponse;
  readonly slug: string;
  readonly path?: string;
}

export function buildHotsiteMetadata({
  manifest,
  slug,
  path = '',
}: BuildHotsiteMetadataParams): Metadata {
  const url = `${SITE_URL}/${slug}${path}`;
  const title = `${manifest.tenant.name} — Agendamento Online`;
  const description = `Agende seu serviço na ${manifest.tenant.name}. Rápido, fácil e online.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'BeloAuto',
      locale: 'pt_BR',
      type: 'website',
      images: manifest.branding.logoUrl
        ? [{ url: manifest.branding.logoUrl, width: 1200, height: 630 }]
        : [],
    },
    robots: manifest.isPublished ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export interface LocalBusinessJsonLd {
  readonly '@context': 'https://schema.org';
  readonly '@type': 'LocalBusiness';
  readonly name: string;
  readonly url: string;
}

export interface BuildLocalBusinessJsonLdParams {
  readonly manifest: HotsiteManifestResponse;
  readonly slug: string;
}

export function buildLocalBusinessJsonLd({
  manifest,
  slug,
}: BuildLocalBusinessJsonLdParams): LocalBusinessJsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: manifest.tenant.name,
    url: `${SITE_URL}/${slug}`,
  };
}
