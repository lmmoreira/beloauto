// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DaySummary } from '@beloauto/types';
import { fetchAvailabilitySummary } from '@/lib/api/schedule';
import { AvailabilityCarousel } from './AvailabilityCarousel';

vi.mock('@/lib/api/schedule', () => ({
  fetchAvailabilitySummary: vi.fn(),
  fetchAvailability: vi.fn(),
}));

describe('AvailabilityCarousel', () => {
  afterEach(() => {
    vi.mocked(fetchAvailabilitySummary).mockReset();
  });

  it('shows a loading message while fetching', () => {
    vi.mocked(fetchAvailabilitySummary).mockReturnValue(new Promise(() => {}));

    render(
      <AvailabilityCarousel
        slug="lavacar-beloauto"
        serviceIds={['svc-1']}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />,
    );

    expect(screen.getByText('Carregando disponibilidade...')).toBeInTheDocument();
  });

  it('renders day cards with weekday labels, marking the first as "Hoje"', async () => {
    const days: DaySummary[] = [
      { date: '2026-06-15', available: true, slotCount: 5 },
      { date: '2026-06-16', available: true, slotCount: 3 },
      { date: '2026-06-17', available: false, slotCount: 0 },
    ];
    vi.mocked(fetchAvailabilitySummary).mockResolvedValue(days);

    render(
      <AvailabilityCarousel
        slug="lavacar-beloauto"
        serviceIds={['svc-1']}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('day-card-2026-06-15')).toBeInTheDocument();
    expect(screen.getByText('Hoje')).toBeInTheDocument();
    expect(screen.getByText('Ter')).toBeInTheDocument();
  });

  it('disables day cards with available: false', async () => {
    const days: DaySummary[] = [
      { date: '2026-06-15', available: true, slotCount: 5 },
      { date: '2026-06-17', available: false, slotCount: 0 },
    ];
    vi.mocked(fetchAvailabilitySummary).mockResolvedValue(days);

    render(
      <AvailabilityCarousel
        slug="lavacar-beloauto"
        serviceIds={['svc-1']}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('day-card-2026-06-17')).toBeDisabled();
    expect(screen.getByTestId('day-card-2026-06-15')).not.toBeDisabled();
  });

  it('calls onSelectDate when an available day card is clicked', async () => {
    const user = userEvent.setup();
    const days: DaySummary[] = [{ date: '2026-06-15', available: true, slotCount: 5 }];
    vi.mocked(fetchAvailabilitySummary).mockResolvedValue(days);
    const onSelectDate = vi.fn();

    render(
      <AvailabilityCarousel
        slug="lavacar-beloauto"
        serviceIds={['svc-1']}
        selectedDate={null}
        onSelectDate={onSelectDate}
      />,
    );

    await user.click(await screen.findByTestId('day-card-2026-06-15'));

    expect(onSelectDate).toHaveBeenCalledWith('2026-06-15');
  });

  it('highlights the selected day card', async () => {
    const days: DaySummary[] = [{ date: '2026-06-15', available: true, slotCount: 5 }];
    vi.mocked(fetchAvailabilitySummary).mockResolvedValue(days);

    render(
      <AvailabilityCarousel
        slug="lavacar-beloauto"
        serviceIds={['svc-1']}
        selectedDate="2026-06-15"
        onSelectDate={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('day-card-2026-06-15')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(fetchAvailabilitySummary).mockRejectedValue(new Error('network error'));

    render(
      <AvailabilityCarousel
        slug="lavacar-beloauto"
        serviceIds={['svc-1']}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />,
    );

    expect(
      await screen.findByText('Não foi possível carregar a disponibilidade. Tente novamente.'),
    ).toBeInTheDocument();
  });
});
