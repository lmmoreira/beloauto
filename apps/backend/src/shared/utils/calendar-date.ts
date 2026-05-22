export type WeekDayName =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

const WEEKDAY_NAMES: WeekDayName[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/**
 * Returns the UTC day-of-week name for a YYYY-MM-DD date string.
 * Parsing uses T00:00:00Z to avoid local-timezone day shifts.
 */
export function getUtcWeekDayName(date: string): WeekDayName {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}
