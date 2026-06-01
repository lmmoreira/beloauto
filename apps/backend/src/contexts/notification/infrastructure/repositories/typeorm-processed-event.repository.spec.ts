import { InMemoryNotificationProcessedEventRepository } from '../../../../test/repositories/notification/in-memory-processed-event.repository';

const EVENT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const NOTIFICATION_TYPE = 'booking-approved-customer';
const CHANNEL = 'EMAIL';

describe('InMemoryNotificationProcessedEventRepository', () => {
  let repo: InMemoryNotificationProcessedEventRepository;

  beforeEach(() => {
    repo = new InMemoryNotificationProcessedEventRepository();
  });

  it('isDuplicate returns false for unseen event', async () => {
    const result = await repo.isDuplicate(EVENT_ID, NOTIFICATION_TYPE, CHANNEL);
    expect(result).toBe(false);
  });

  it('markProcessed then isDuplicate returns true', async () => {
    await repo.markProcessed(EVENT_ID, NOTIFICATION_TYPE, CHANNEL);
    const result = await repo.isDuplicate(EVENT_ID, NOTIFICATION_TYPE, CHANNEL);
    expect(result).toBe(true);
  });

  it('same eventId with different notificationType is not a duplicate', async () => {
    await repo.markProcessed(EVENT_ID, NOTIFICATION_TYPE, CHANNEL);
    const result = await repo.isDuplicate(EVENT_ID, 'booking-requested-admin', CHANNEL);
    expect(result).toBe(false);
  });

  it('same eventId and notificationType with different channel is not a duplicate', async () => {
    await repo.markProcessed(EVENT_ID, NOTIFICATION_TYPE, CHANNEL);
    const result = await repo.isDuplicate(EVENT_ID, NOTIFICATION_TYPE, 'SMS');
    expect(result).toBe(false);
  });

  it('markProcessed is idempotent: calling twice does not error', async () => {
    await repo.markProcessed(EVENT_ID, NOTIFICATION_TYPE, CHANNEL);
    await repo.markProcessed(EVENT_ID, NOTIFICATION_TYPE, CHANNEL);
    const result = await repo.isDuplicate(EVENT_ID, NOTIFICATION_TYPE, CHANNEL);
    expect(result).toBe(true);
  });
});
