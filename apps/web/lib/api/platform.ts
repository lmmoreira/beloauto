import { notFound } from 'next/navigation';
import type { HotsiteManifestResponse } from '@beloauto/types';

export async function fetchManifest(slug: string): Promise<HotsiteManifestResponse> {
  const isDev = process.env.NODE_ENV === 'development';
  const res = await fetch(`${process.env.NEXT_PUBLIC_BFF_URL}/platform/manifest/${slug}`, {
    next: { revalidate: isDev ? 0 : 300 },
  });

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Failed to fetch manifest for slug "${slug}"`);

  return res.json() as Promise<HotsiteManifestResponse>;
}
