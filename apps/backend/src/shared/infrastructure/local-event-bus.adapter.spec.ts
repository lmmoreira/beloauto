import { DomainEvent } from '../domain/domain-event';
import { LocalEventBusAdapter } from './local-event-bus.adapter';

class TestEvent extends DomainEvent<{ value: string }> {
  readonly eventName = 'TestEvent';
  readonly eventVersion = 1;
  readonly data: { value: string };

  constructor(data: { value: string }) {
    super('tenant-1', 'corr-1');
    this.data = data;
  }
}

describe('LocalEventBusAdapter', () => {
  let adapter: LocalEventBusAdapter;

  beforeEach(() => {
    adapter = new LocalEventBusAdapter();
  });

  it('publish() routes event to a subscribed handler', async () => {
    const received: DomainEvent[] = [];
    adapter.subscribe('TestEvent', async (e) => {
      received.push(e);
    });

    const event = new TestEvent({ value: 'hello' });
    await adapter.publish(event);

    expect(received).toHaveLength(1);
    expect((received[0] as TestEvent).data.value).toBe('hello');
  });

  it('publish() calls all handlers registered for the same event name', async () => {
    const calls: number[] = [];
    adapter.subscribe('TestEvent', async () => {
      calls.push(1);
    });
    adapter.subscribe('TestEvent', async () => {
      calls.push(2);
    });

    await adapter.publish(new TestEvent({ value: 'x' }));

    expect(calls).toEqual([1, 2]);
  });

  it('publish() does not call handlers registered for a different event', async () => {
    const called: boolean[] = [];
    adapter.subscribe('OtherEvent', async () => {
      called.push(true);
    });

    await adapter.publish(new TestEvent({ value: 'x' }));

    expect(called).toHaveLength(0);
  });

  it('publish() does not throw when no subscribers exist for the event', async () => {
    await expect(adapter.publish(new TestEvent({ value: 'x' }))).resolves.toBeUndefined();
  });

  it('publish() catches handler errors and continues without rethrowing', async () => {
    const secondHandlerCalled: boolean[] = [];
    adapter.subscribe('TestEvent', async () => {
      throw new Error('handler boom');
    });
    adapter.subscribe('TestEvent', async () => {
      secondHandlerCalled.push(true);
    });

    await expect(adapter.publish(new TestEvent({ value: 'x' }))).resolves.toBeUndefined();
    expect(secondHandlerCalled).toHaveLength(1);
  });

  it('subscribe() supports multiple event types independently', async () => {
    const aReceived: DomainEvent[] = [];
    const bReceived: DomainEvent[] = [];
    adapter.subscribe('TestEvent', async (e) => {
      aReceived.push(e);
    });
    adapter.subscribe('OtherEvent', async (e) => {
      bReceived.push(e);
    });

    await adapter.publish(new TestEvent({ value: 'only-a' }));

    expect(aReceived).toHaveLength(1);
    expect(bReceived).toHaveLength(0);
  });
});
