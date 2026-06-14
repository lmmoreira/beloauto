import type React from 'react';
import type { HotsiteServiceResponse } from '@beloauto/types';
import { formatDuration } from '@/lib/hotsite/format-duration';
import { formatBRL } from '@/lib/hotsite/format-money';

interface ServiceSelectionStepProps {
  readonly services: readonly HotsiteServiceResponse[];
  readonly selectedServiceIds: readonly string[];
  readonly onToggleService: (serviceId: string) => void;
  readonly onNext: () => void;
}

const btnStyle: React.CSSProperties = {
  backgroundColor: 'var(--ba-btn-bg)',
  color: 'var(--ba-btn-text)',
  borderColor: 'var(--ba-btn-border)',
  borderRadius: 'var(--ba-radius)',
};

function cardStyle(isSelected: boolean): React.CSSProperties {
  return {
    borderRadius: 'var(--ba-radius)',
    borderColor: isSelected ? 'var(--ba-primary)' : 'var(--ba-secondary)',
  };
}

export function ServiceSelectionStep({
  services,
  selectedServiceIds,
  onToggleService,
  onNext,
}: ServiceSelectionStepProps) {
  const selected = services.filter((service) => selectedServiceIds.includes(service.id));
  const totalAmount = selected.reduce((sum, service) => sum + service.price.amount, 0);
  const totalDuration = selected.reduce((sum, service) => sum + service.durationMinutes, 0);
  const serviceWord = selected.length === 1 ? 'serviço' : 'serviços';

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold" style={{ color: 'var(--ba-text)' }}>
        Escolha os serviços
      </h2>

      <ul className="flex flex-col gap-3">
        {services.map((service) => {
          const isSelected = selectedServiceIds.includes(service.id);
          return (
            <li key={service.id}>
              <label
                className="flex cursor-pointer items-center gap-3 border p-4"
                style={cardStyle(isSelected)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleService(service.id)}
                />
                <div className="flex-1">
                  <p className="font-semibold" style={{ color: 'var(--ba-text)' }}>
                    {service.name}
                  </p>
                  {service.description && (
                    <p className="text-sm opacity-75">{service.description}</p>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold" style={{ color: 'var(--ba-primary)' }}>
                    {service.price.formatted}
                  </p>
                  <p className="opacity-75">{formatDuration(service.durationMinutes)}</p>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      {selected.length > 0 && (
        <p
          className="mt-4 font-semibold"
          style={{ color: 'var(--ba-text)' }}
          data-testid="selection-total"
        >
          {selected.length} {serviceWord} — {formatBRL(totalAmount)} —{' '}
          {formatDuration(totalDuration)}
        </p>
      )}

      <button
        type="button"
        disabled={selected.length === 0}
        onClick={onNext}
        style={btnStyle}
        className="mt-6 border-2 px-8 py-3 font-semibold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Próximo
      </button>
    </div>
  );
}
