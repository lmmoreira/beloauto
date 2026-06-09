import type { HotsiteModuleType } from '@beloauto/types';
import { fetchManifest } from '@/lib/api/tenant';
import { Footer } from '@/components/hotsite/Footer';

type ModuleComponent = React.ComponentType<{ data: Record<string, unknown>; slug: string }>;

// Module components registered here as each story (M12-S04 to S06) lands
const MODULE_MAP: Partial<Record<HotsiteModuleType, ModuleComponent>> = {};

interface HotsitePageProps {
  params: Promise<{ slug: string }>;
}

export default async function HotsitePage({ params }: HotsitePageProps) {
  const { slug } = await params;
  const manifest = await fetchManifest(slug);

  return (
    <main>
      {manifest.layout
        .filter((m) => m.enabled)
        .map((m) => {
          const Component = MODULE_MAP[m.type];
          return Component ? <Component key={m.type} data={m.data} slug={slug} /> : null;
        })}
      <Footer slug={slug} />
    </main>
  );
}
