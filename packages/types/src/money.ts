export interface Money {
  amount: number;
  currency: 'BRL';
  formatted: string; // always "R$ 1.234,56"
}

export interface MoneyAmount {
  amount: number;
  currency: string;
}
