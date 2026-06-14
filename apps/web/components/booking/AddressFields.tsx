'use client';

import { useState } from 'react';
import type { Address } from '@beloauto/types';
import type { AddressLookup } from '@/lib/address/address-lookup.port';
import { viaCepAddressLookup } from '@/lib/address/viacep-address-lookup.adapter';

interface AddressFieldsProps {
  readonly value: Address;
  readonly onChange: (address: Address) => void;
  readonly idPrefix: string;
  readonly addressLookup?: AddressLookup;
}

interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly inputMode?: 'text' | 'numeric';
  readonly placeholder?: string;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

const inputStyle = { borderRadius: 'var(--ba-radius)', borderColor: 'var(--ba-secondary)' };

function TextField({
  id,
  label,
  value,
  onChange,
  required,
  maxLength,
  inputMode,
  placeholder,
}: TextFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium"
        style={{ color: 'var(--ba-text)' }}
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border px-3 py-2"
        style={inputStyle}
      />
    </div>
  );
}

export function AddressFields({
  value,
  onChange,
  idPrefix,
  addressLookup = viaCepAddressLookup,
}: AddressFieldsProps) {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  async function handleZipCodeChange(zipCode: string) {
    const digits = digitsOnly(zipCode);
    onChange({ ...value, zipCode: digits });
    setLookupFailed(false);

    if (digits.length !== 8) return;

    setIsLookingUp(true);
    const result = await addressLookup.lookup(digits);
    setIsLookingUp(false);

    if (!result) {
      setLookupFailed(true);
      return;
    }

    onChange({ ...value, zipCode: digits, ...result });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <TextField
          id={`${idPrefix}-zip-code`}
          label="CEP"
          value={value.zipCode}
          onChange={handleZipCodeChange}
          inputMode="numeric"
          maxLength={9}
          placeholder="00000-000"
          required
        />
        {isLookingUp && (
          <p className="mt-1 text-sm opacity-75" data-testid={`${idPrefix}-lookup-loading`}>
            Buscando endereço...
          </p>
        )}
        {lookupFailed && (
          <p className="mt-1 text-sm opacity-75" data-testid={`${idPrefix}-lookup-failed`}>
            CEP não encontrado. Preencha o endereço manualmente.
          </p>
        )}
      </div>

      <div className="sm:col-span-4">
        <TextField
          id={`${idPrefix}-street`}
          label="Rua"
          value={value.street}
          onChange={(street) => onChange({ ...value, street })}
          required
        />
      </div>

      <div className="sm:col-span-2">
        <TextField
          id={`${idPrefix}-number`}
          label="Número"
          value={value.number}
          onChange={(number) => onChange({ ...value, number })}
          required
        />
      </div>

      <div className="sm:col-span-4">
        <TextField
          id={`${idPrefix}-complement`}
          label="Complemento"
          value={value.complement ?? ''}
          onChange={(complement) => onChange({ ...value, complement })}
        />
      </div>

      <div className="sm:col-span-3">
        <TextField
          id={`${idPrefix}-neighborhood`}
          label="Bairro"
          value={value.neighborhood}
          onChange={(neighborhood) => onChange({ ...value, neighborhood })}
          required
        />
      </div>

      <div className="sm:col-span-2">
        <TextField
          id={`${idPrefix}-city`}
          label="Cidade"
          value={value.city}
          onChange={(city) => onChange({ ...value, city })}
          required
        />
      </div>

      <div className="sm:col-span-1">
        <TextField
          id={`${idPrefix}-state`}
          label="UF"
          value={value.state}
          onChange={(state) => onChange({ ...value, state })}
          maxLength={2}
          required
        />
      </div>
    </div>
  );
}
