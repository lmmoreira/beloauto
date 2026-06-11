import type React from 'react';
import type { GalleryModuleData } from '@beloauto/types';
import { sectionHeadingFont } from '@/lib/hotsite/module-styles';
import { GalleryGrid } from './GalleryGrid';
import { GalleryItem } from './GalleryItem';

interface GalleryModuleProps {
  readonly data: GalleryModuleData;
  readonly slug: string;
}

const headingStyle: React.CSSProperties = {
  ...sectionHeadingFont,
  color: 'var(--ba-text)',
};

export function GalleryModule({ data, slug: _ }: GalleryModuleProps) {
  if (data.images.length === 0) {
    return null;
  }

  const title = data.title ?? 'Nossos Resultados';

  return (
    <section
      style={{
        backgroundColor: 'var(--ba-background)',
        color: 'var(--ba-text)',
        padding: 'var(--ba-section-py) 1.5rem',
      }}
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-10 text-center text-3xl font-bold" style={headingStyle}>
          {title}
        </h2>
        <GalleryGrid maxVisible={data.maxVisible} layout={data.layout}>
          {data.images.map((image, index) => (
            <GalleryItem key={`${image.url}-${index}`} image={image} />
          ))}
        </GalleryGrid>
      </div>
    </section>
  );
}
