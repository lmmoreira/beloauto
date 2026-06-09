import { fetchManifest } from '@/lib/api/tenant';
import { applyBranding } from '@/lib/hotsite/apply-branding';
import { FONT_VARIABLES } from '@/lib/hotsite/font-config';

interface HotsiteLayoutProps {
  readonly children: React.ReactNode;
  readonly params: Promise<{ readonly slug: string }>;
}

export default async function HotsiteLayout({ children, params }: HotsiteLayoutProps) {
  const { slug } = await params;
  const manifest = await fetchManifest(slug);

  const brandingStyles = applyBranding(manifest.branding);

  return (
    <div
      id="hotsite-root"
      style={{ ...brandingStyles, fontFamily: 'var(--ba-body-font)' }}
      className={FONT_VARIABLES.join(' ')}
    >
      {children}
    </div>
  );
}
