'use client';

import { useEffect, useState } from 'react';
import type { AvailableSlot } from '@beloauto/types';
import { fetchAvailability } from '@/lib/api/schedule';
import { formatTimeBR } from '@/lib/booking/format-time';

interface SlotPickerProps {
  readonly slug: string;
  readonly serviceIds: readonly string[];
  readonly date: string;
  readonly selectedSlot: AvailableSlot | null;
  readonly onSelectSlot: (slot: AvailableSlot) => void;
}

export function SlotPicker({
  slug,
  serviceIds,
  date,
  selectedSlot,
  onSelectSlot,
}: SlotPickerProps) {
  const [result, setResult] = useState<{ date: string; slots: AvailableSlot[] } | null>(null);
  const [errorDate, setErrorDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAvailability(slug, date, serviceIds)
      .then((response) => {
        if (!cancelled) setResult({ date, slots: response.slots });
      })
      .catch(() => {
        if (!cancelled) setErrorDate(date);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, date, serviceIds]);

  if (errorDate === date) {
    return <p>Não foi possível carregar os horários. Tente novamente.</p>;
  }

  if (result?.date !== date) {
    return <p>Carregando horários...</p>;
  }

  const { slots } = result;

  if (slots.length === 0) {
    return <p>Nenhum horário disponível</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => {
        const isSelected = selectedSlot?.startsAt === slot.startsAt;
        return (
          <button
            key={slot.startsAt}
            type="button"
            onClick={() => onSelectSlot(slot)}
            aria-pressed={isSelected}
            className="w-full border py-2 text-center text-sm font-medium transition-colors"
            style={{
              borderRadius: 'var(--ba-radius)',
              backgroundColor: isSelected ? 'var(--ba-primary)' : undefined,
              borderColor: isSelected ? 'var(--ba-primary)' : 'var(--ba-secondary)',
              color: isSelected ? 'var(--ba-btn-text)' : 'var(--ba-text)',
            }}
          >
            {formatTimeBR(slot.startsAt)}–{formatTimeBR(slot.endsAt)}
          </button>
        );
      })}
    </div>
  );
}
