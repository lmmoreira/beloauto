import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../shared/ports/transaction-manager.port';
import { AppLogger } from '../../../../shared/observability/app-logger';
import { EVENT_BUS, IEventBus } from '../../../../shared/ports/event-bus.port';
import { TenantProvisioned } from '../../../platform/domain/events/tenant-provisioned.event';
import { STAFF_REPOSITORY, IStaffRepository } from '../../application/ports/staff-repository.port';
import { Staff } from '../../domain/staff.aggregate';
import { StaffInvited } from '../../domain/events/staff-invited.event';

@Injectable()
export class TenantProvisionedHandler implements OnModuleInit {
  private readonly logger = new AppLogger(TenantProvisionedHandler.name);
  private readonly processedEventIds = new Set<string>();

  constructor(
    @Inject(STAFF_REPOSITORY) private readonly staffRepo: IStaffRepository,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<TenantProvisioned>('TenantProvisioned', (event) => this.handle(event));
  }

  async handle(event: TenantProvisioned): Promise<void> {
    const { tenantId, correlationId } = event;
    const { adminEmail } = event.data;

    if (this.processedEventIds.has(event.eventId)) {
      this.logger.debug('TenantProvisioned already processed — skipping', {
        tenantId,
        eventId: event.eventId,
        correlationId,
      });
      return;
    }

    const existing = await this.staffRepo.findByTenantAndEmail(tenantId, adminEmail);
    if (existing) {
      this.logger.debug('MANAGER staff already exists for tenant — skipping', {
        tenantId,
        correlationId,
      });
      this.processedEventIds.add(event.eventId);
      return;
    }

    const staff = Staff.inviteFromProvisioning(tenantId, adminEmail);

    await this.txManager.run(async () => {
      await this.staffRepo.save(staff);
    });

    this.processedEventIds.add(event.eventId);

    await this.eventBus.publish(new StaffInvited(tenantId, correlationId, { staffId: staff.id }));

    this.logger.log('Staff MANAGER created from TenantProvisioned', {
      tenantId,
      staffId: staff.id,
      correlationId,
    });
  }
}
