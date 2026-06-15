import type { AddressLookup, AddressLookupResult } from './address-lookup.port';

export class InMemoryAddressLookup implements AddressLookup {
  constructor(private readonly results: Record<string, AddressLookupResult | null>) {}

  async lookup(cep: string): Promise<AddressLookupResult | null> {
    return this.results[cep] ?? null;
  }
}
