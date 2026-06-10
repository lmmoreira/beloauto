import type { HotsiteModuleType, ServiceListModuleData } from '@beloauto/types';
import { fetchManifest } from '@/lib/api/tenant';
import { fetchServices } from '@/lib/api/services';
import { Footer } from '@/components/hotsite/Footer';
import { HeroModule } from '@/components/hotsite/HeroModule';
import { ServiceListModule } from '@/components/hotsite/ServiceListModule';
import { isValidModuleData } from '@/lib/hotsite/module-schemas';

type ModuleComponent = React.ComponentType<{ data: Record<string, unknown>; slug: string }>;

// Each module story (M12-S04 to S06) registers its component here. SERVICE_LIST is handled
// separately below — it needs live service data fetched at page level, not just manifest data.
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

  const hasServiceList = manifest.layout.some((m) => m.enabled && m.type === 'SERVICE_LIST');
  const services = hasServiceList ? await fetchServices(slug) : [];

  return (
    <main>
      {manifest.layout
        .filter((m) => m.enabled)
        .map((m, index) => {
          // Skip modules with data that fails its schema — a single malformed module must not
          // take down the whole hotsite page.
          if (!isValidModuleData(m.type, m.data)) {
            return null;
          }

          if (m.type === 'SERVICE_LIST') {
            return (
              <ServiceListModule
                key={`${m.type}-${index}`}
                data={m.data as unknown as ServiceListModuleData}
                slug={slug}
                services={services}
              />
            );
          }

          const Component = MODULE_MAP[m.type];
          if (!Component) {
            return null;
          }
          return <Component key={`${m.type}-${index}`} data={m.data} slug={slug} />;
        })}
      <Footer slug={slug} />
    </main>
  );
}
