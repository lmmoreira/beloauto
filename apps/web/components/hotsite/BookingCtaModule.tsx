import Image from 'next/image';
import type React from 'react';
import type { BookingCtaModuleData } from '@beloauto/types';
import { sectionHeadingFont } from '@/lib/hotsite/module-styles';

interface BookingCtaModuleProps {
  readonly data: BookingCtaModuleData;
  readonly slug: string;
}

const btnStyle: React.CSSProperties = {
  backgroundColor: 'var(--ba-btn-bg)',
  color: 'var(--ba-btn-text)',
  borderColor: 'var(--ba-btn-border)',
  borderRadius: 'var(--ba-radius)',
};

const headingStyle: React.CSSProperties = {
  ...sectionHeadingFont,
  color: 'var(--ba-hero-text)',
};

function BookingCtaContent({
  data,
  slug,
}: {
  readonly data: BookingCtaModuleData;
  readonly slug: string;
}) {
  return (
    <>
      <h2 className="mb-4 text-3xl font-bold sm:text-4xl" style={headingStyle}>
        {data.title}
      </h2>
      {data.subtitle && (
        <p
          className="mb-8 text-lg opacity-90"
          style={{ color: 'var(--ba-hero-text)' }}
          data-testid="booking-cta-subtitle"
        >
          {data.subtitle}
        </p>
      )}
      <a
        href={`/${slug}/booking`}
        style={btnStyle}
        className="inline-block border-2 px-8 py-3 font-semibold transition-all hover:bg-[var(--ba-btn-hover-bg)] hover:opacity-90"
      >
        {data.ctaLabel}
      </a>
    </>
  );
}

export function BookingCtaModule({ data, slug }: BookingCtaModuleProps) {
  const bgUrl = data.backgroundImageUrl;
  const variant = data.variant ?? 'centered';

  if (variant === 'left-aligned') {
    return (
      <section
        id="booking-form"
        className="relative min-h-[40vh] flex items-center"
        style={{ backgroundColor: 'var(--ba-primary)' }}
      >
        <div className="w-full px-6 py-16 max-w-7xl mx-auto">
          <div className={`grid grid-cols-1 ${bgUrl ? 'sm:grid-cols-2' : ''} gap-12 items-center`}>
            <div>
              <BookingCtaContent data={data} slug={slug} />
            </div>
            {bgUrl && (
              <div className="relative h-64 sm:h-full sm:min-h-[40vh]">
                <Image
                  src={bgUrl}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                  style={{ borderRadius: 'var(--ba-radius)' }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="booking-form"
      className="relative flex min-h-[40vh] items-center justify-center px-6 py-20 text-center sm:py-28"
      style={{ backgroundColor: bgUrl ? undefined : 'var(--ba-primary)' }}
    >
      {bgUrl && <Image src={bgUrl} alt="" fill sizes="100vw" className="object-cover" />}
      <div className="relative z-10 mx-auto max-w-2xl">
        <BookingCtaContent data={data} slug={slug} />
      </div>
    </section>
  );
}
