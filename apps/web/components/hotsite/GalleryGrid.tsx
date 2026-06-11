'use client';

import { useState, useRef, useEffect, type CSSProperties } from 'react';
import type { GalleryImage } from '@beloauto/types';
import { GalleryItem } from './GalleryItem';

interface GalleryGridProps {
  readonly images: readonly GalleryImage[];
  readonly maxVisible: number;
  readonly layout: 'grid' | 'masonry';
}

const btnStyle: CSSProperties = {
  backgroundColor: 'var(--ba-btn-bg)',
  color: 'var(--ba-btn-text)',
  borderColor: 'var(--ba-btn-border)',
  borderRadius: 'var(--ba-radius)',
};

const closeBtnStyle: CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.9)',
  borderRadius: '50%',
};

export function GalleryGrid({ images, maxVisible, layout }: GalleryGridProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxImage) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [lightboxImage]);

  const visible = expanded ? images : images.slice(0, maxVisible);
  const hasMore = images.length > maxVisible;

  const containerClassName =
    layout === 'masonry'
      ? 'columns-2 sm:columns-3 gap-4 [&>*]:mb-4'
      : 'grid grid-cols-2 sm:grid-cols-3 gap-4';

  return (
    <>
      <div className={containerClassName}>
        {visible.map((image, index) => (
          <a
            key={`${image.url}-${index}`}
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              setLightboxImage(image);
            }}
            className="block cursor-zoom-in"
          >
            <GalleryItem image={image} priority={index === 0} />
          </a>
        ))}
      </div>

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

      <dialog
        ref={dialogRef}
        onClose={() => setLightboxImage(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setLightboxImage(null);
        }}
        style={{
          width: '100vw',
          height: '100dvh',
          maxWidth: '100vw',
          maxHeight: '100dvh',
          margin: 0,
          padding: '2rem',
          background: 'transparent',
          border: 'none',
        }}
        className="flex items-center justify-center backdrop:bg-black/80"
      >
        {lightboxImage && (
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Fechar"
              style={closeBtnStyle}
              className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center shadow-lg hover:bg-white"
            >
              ×
            </button>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.caption ?? 'Foto da lavagem'}
              style={{
                maxWidth: 'min(85vw, 1200px)',
                maxHeight: '85dvh',
                borderRadius: 'var(--ba-radius)',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            {lightboxImage.caption && (
              <p className="mt-2 text-center text-sm text-white">{lightboxImage.caption}</p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
