import type { HotsiteBrandingResponse } from '@beloauto/types';
import type React from 'react';

import { FONT_MAP } from './font-config';

const BORDER_RADIUS = { sharp: '0px', rounded: '8px', pill: '9999px' };
const SECTION_PY = { compact: '3rem', comfortable: '5rem', spacious: '8rem' };
const SHADOW = {
  none: 'none',
  subtle: '0 1px 3px rgba(0,0,0,0.10)',
  strong: '0 4px 16px rgba(0,0,0,0.20)',
};

export function applyBranding(
  branding: HotsiteBrandingResponse,
): React.CSSProperties & Record<`--ba-${string}`, string> {
  return {
    '--ba-primary': branding.primaryColor,
    '--ba-secondary': branding.secondaryColor,
    '--ba-background': branding.backgroundColor,
    '--ba-text': branding.textColor,
    '--ba-heading-font': FONT_MAP[branding.headingFontFamily] ?? FONT_MAP['Inter'],
    '--ba-body-font': FONT_MAP[branding.bodyFontFamily] ?? FONT_MAP['Inter'],
    '--ba-radius': BORDER_RADIUS[branding.borderRadius],
    '--ba-section-py': SECTION_PY[branding.spacing],
    '--ba-shadow': SHADOW[branding.shadowStyle],
    '--ba-btn-variant': branding.buttonStyle,
  };
}
