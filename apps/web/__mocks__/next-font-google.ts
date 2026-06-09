// Replaces next/font/google in the Vitest environment.
// The real module writes font metadata to disk during Next.js build — unusable in tests.
const font = (id: string) => (): { variable: string; className: string } => ({
  variable: `--font-${id}`,
  className: `font-${id}`,
});

export const Inter = font('inter');
export const Poppins = font('poppins');
export const Playfair_Display = font('playfair-display');
export const Montserrat = font('montserrat');
export const Raleway = font('raleway');
export const Oswald = font('oswald');
export const Lato = font('lato');
export const Roboto = font('roboto');
