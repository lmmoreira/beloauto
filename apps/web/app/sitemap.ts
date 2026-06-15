import type { MetadataRoute } from 'next';
import { fetchPublishedHotsiteSlugs } from '@/lib/api/platform';
import { SITE_URL } from '@/lib/hotsite/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await fetchPublishedHotsiteSlugs();

  return items.map(({ slug, updatedAt }) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: updatedAt,
  }));
}
