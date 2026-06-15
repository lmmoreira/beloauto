const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(amount: number): string {
  // Intl.NumberFormat inserts a non-breaking space (U+00A0) after "R$"; normalize to a
  // regular space to match the "R$ 1.234,56" format used by Money.format() on the backend.
  return BRL_FORMATTER.format(amount).replace(' ', ' ');
}
