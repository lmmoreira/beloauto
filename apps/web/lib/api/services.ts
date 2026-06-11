import type { HotsiteServiceListResponse, HotsiteServiceResponse } from '@beloauto/types';

export async function fetchServices(slug: string): Promise<HotsiteServiceResponse[]> {
  const isDev = process.env.NODE_ENV === 'development';
  const res = await fetch(`${process.env.NEXT_PUBLIC_BFF_URL}/services`, {
    headers: { 'X-Tenant-Slug': slug },
    next: { revalidate: isDev ? 0 : 300 },
  });

  if (!res.ok) throw new Error(`Failed to fetch services for slug "${slug}"`);

  const data = (await res.json()) as HotsiteServiceListResponse;
  return data.items;
}
