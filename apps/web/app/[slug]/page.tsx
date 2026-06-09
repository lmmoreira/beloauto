import type { HotsiteModuleType } from '@beloauto/types';
import { fetchManifest } from '@/lib/api/tenant';
import { Footer } from '@/components/hotsite/Footer';
import { HeroModule } from '@/components/hotsite/HeroModule';

type ModuleComponent = React.ComponentType<{ data: Record<string, unknown>; slug: string }>;

// Each module story (M12-S04 to S06) registers its component here.
// HeroModule is typed as { data: HeroModuleData; slug: string } — cast only at this boundary.
const MODULE_MAP: Partial<Record<HotsiteModuleType, ModuleComponent>> = {
  // HeroModule is typed as { data: HeroModuleData; slug: string } — double cast isolates the
  // type erasure to this single registry boundary; the component's own props stay fully typed.
  HERO: HeroModule as unknown as ModuleComponent,
};

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
