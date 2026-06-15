import type { Metadata } from 'next';
import type { HotsiteManifestResponse } from '@beloauto/types';

function stripTrailingSlashes(value: string): string {
  let result = value;
  while (result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result;
}

export const SITE_URL = stripTrailingSlashes(
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
);

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

// Escapes "<" so a "</script>" sequence in JSON-LD data cannot break out of the
// surrounding <script type="application/ld+json"> tag (< is valid inside a JSON string).
export function toJsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
