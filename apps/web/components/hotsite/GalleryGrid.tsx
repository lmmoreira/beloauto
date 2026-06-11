'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';

interface GalleryGridProps {
  readonly children: readonly ReactNode[];
  readonly maxVisible: number;
  readonly layout: 'grid' | 'masonry';
}

const btnStyle: CSSProperties = {
  backgroundColor: 'var(--ba-btn-bg)',
  color: 'var(--ba-btn-text)',
  borderColor: 'var(--ba-btn-border)',
  borderRadius: 'var(--ba-radius)',
};

export function GalleryGrid({ children, maxVisible, layout }: GalleryGridProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? children : children.slice(0, maxVisible);
  const hasMore = children.length > maxVisible;

  const containerClassName =
    layout === 'masonry'
      ? 'columns-2 sm:columns-3 gap-4 [&>*]:mb-4'
      : 'grid grid-cols-2 sm:grid-cols-3 gap-4';

  return (
    <>
      <div className={containerClassName}>{visible}</div>
      {hasMore && !expanded && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            style={btnStyle}
            className="inline-block border-2 px-8 py-3 font-semibold transition-all hover:opacity-90 hover:bg-[var(--ba-btn-hover-bg)]"
          >
            Ver mais
          </button>
        </div>
      )}
    </>
  );
}
