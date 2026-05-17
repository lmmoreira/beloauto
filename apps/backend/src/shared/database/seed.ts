import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

// ── Fixed UUIDs ensure idempotency across multiple runs ──────────────────────
const IDS = {
  tenantA: '00000000-0000-7000-8000-000000000001',
  tenantB: '00000000-0000-7000-8000-000000000002',

  staffAdminA: '00000000-0000-7000-8001-000000000001',
  staffWorkerA: '00000000-0000-7000-8001-000000000002',
  staffAdminB: '00000000-0000-7000-8001-000000000003',

  customerA1: '00000000-0000-7000-8002-000000000001', // cliente@ in tenant A
  customerA2: '00000000-0000-7000-8002-000000000002', // cliente@ in tenant B

  serviceSimples: '00000000-0000-7000-8003-000000000001',
  serviceCompleta: '00000000-0000-7000-8003-000000000002',
  servicePolimento: '00000000-0000-7000-8003-000000000003',
  serviceHigienizacao: '00000000-0000-7000-8003-000000000004',

  hotsiteA: '00000000-0000-7000-8004-000000000001',
  hotsiteB: '00000000-0000-7000-8004-000000000002',

  bookingPending: '00000000-0000-7000-8005-000000000001',
  bookingApproved: '00000000-0000-7000-8005-000000000002',
  bookingCompleted: '00000000-0000-7000-8005-000000000003',

  lineCompleted: '00000000-0000-7000-8006-000000000001',
  loyaltyEntry: '00000000-0000-7000-8007-000000000001',
};

// Matches TenantSettingsProps exactly — snake_case keys, null for closed days
const TENANT_SETTINGS = {
  loyalty: {
    expiry_days: 180,
    enable_notifications: true,
    expiry_warning_days: 7,
  },
  booking: {
    cancellation_window_hours: 48,
    auto_approve_enabled: false,
    min_booking_advance_hours: 0,
    max_booking_advance_days: 90,
    service_buffer_minutes: 60,
    slot_granularity_minutes: 30,
  },
  business_hours: {
    timezone: 'America/Sao_Paulo',
    monday: { open: '08:00', close: '18:00' },
    tuesday: { open: '08:00', close: '18:00' },
    wednesday: { open: '08:00', close: '18:00' },
    thursday: { open: '08:00', close: '18:00' },
    friday: { open: '08:00', close: '18:00' },
    saturday: { open: '08:00', close: '14:00' },
    sunday: null, // closed — null means closed, not { closed: true }
  },
  localization: {
    currency: 'BRL',
    currency_symbol: 'R$',
    language: 'pt-BR',
    decimal_places: 2,
  },
};

async function seed(): Promise<void> {
  const host = process.env['DB_HOST'];
  const port = Number(process.env['DB_PORT'] ?? 5432);
  const username = process.env['DB_USER'];
  const password = process.env['DB_PASSWORD'];
  const database = process.env['DB_NAME'];

  if (!host || !username || !password || !database) {
    throw new Error('DB_HOST, DB_USER, DB_PASSWORD, DB_NAME are required');
  }

  const ds = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    synchronize: false,
    migrationsRun: false,
  });

  await ds.initialize();
  const q = ds.createQueryRunner();
  await q.connect();
  await q.startTransaction();

  try {
    await ensureSchemas(q);

    const alreadySeeded = (await q.query(
      `SELECT EXISTS(SELECT 1 FROM platform.tenants WHERE id = $1) AS exists`,
      [IDS.tenantA],
    )) as Array<{ exists: boolean }>;

    if (alreadySeeded[0]?.exists) {
      process.stdout.write('✓ Database already seeded — skipping.\n');
      await q.rollbackTransaction();
      return;
    }

    await seedTenants(q);
    await seedHotsites(q);
    await seedStaff(q);
    await seedCustomers(q);
    await seedServices(q);
    await seedBookings(q);

    await q.commitTransaction();
    printSummary();
  } catch (err) {
    await q.rollbackTransaction();
    throw err;
  } finally {
    await q.release();
    await ds.destroy();
  }
}

// ── Schema bootstrap (CREATE TABLE IF NOT EXISTS — mirrors migration definitions) ─

async function ensureSchemas(q: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  // Schemas
  for (const schema of ['platform', 'customer', 'staff', 'booking', 'loyalty']) {
    await q.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  }

  // platform.tenants — matches CreatePlatformTenants1716500000001
  await q.query(`
    CREATE TABLE IF NOT EXISTS platform.tenants (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(255) NOT NULL,
      slug        VARCHAR(100) NOT NULL,
      settings    JSONB        NOT NULL DEFAULT '{}',
      is_active   BOOLEAN      NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_platform_tenants_slug" UNIQUE (slug)
    )
  `);

  // platform.hotsite_configs — matches CreatePlatformHotsiteConfigs1716500000002
  await q.query(`
    CREATE TABLE IF NOT EXISTS platform.hotsite_configs (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id    UUID        NOT NULL REFERENCES platform.tenants(id),
      branding     JSONB       NOT NULL DEFAULT '{}',
      layout       JSONB       NOT NULL DEFAULT '[]',
      is_published BOOLEAN     NOT NULL DEFAULT false,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_platform_hotsite_configs_tenant_id" UNIQUE (tenant_id)
    )
  `);

  // customer.customers — matches CreateCustomerCustomers1716600000001
  await q.query(`
    CREATE TABLE IF NOT EXISTS customer.customers (
      id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id        UUID         NOT NULL,
      google_oauth_id  VARCHAR(255) NOT NULL,
      email            VARCHAR(255) NOT NULL,
      name             VARCHAR(255) NOT NULL,
      phone            VARCHAR(20),
      default_address  JSONB,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
  `);
  await q.query(`
    CREATE INDEX IF NOT EXISTS "IDX_customer_customers_tenant_id"
      ON customer.customers (tenant_id)
  `);
  await q.query(`
    CREATE INDEX IF NOT EXISTS "IDX_customer_customers_tenant_oauth"
      ON customer.customers (tenant_id, google_oauth_id)
  `);

  // staff.staff — placeholder until M03-S02 migration
  await q.query(`
    CREATE TABLE IF NOT EXISTS staff.staff (
      id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id        UUID         NOT NULL,
      google_oauth_id  VARCHAR(255),
      email            VARCHAR(255) NOT NULL,
      role             VARCHAR(20)  NOT NULL CHECK (role IN ('MANAGER','STAFF')),
      is_active        BOOLEAN      NOT NULL DEFAULT false,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_staff_staff_tenant_oauth" UNIQUE (tenant_id, google_oauth_id)
    )
  `);

  // booking.services — placeholder until M05
  await q.query(`
    CREATE TABLE IF NOT EXISTS booking.services (
      id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id               UUID          NOT NULL,
      name                    VARCHAR(255)  NOT NULL,
      description             TEXT,
      price_amount            NUMERIC(10,2) NOT NULL,
      price_currency          VARCHAR(10)   NOT NULL DEFAULT 'BRL',
      duration_minutes        INTEGER       NOT NULL,
      loyalty_points          INTEGER       NOT NULL DEFAULT 0,
      requires_pickup_address BOOLEAN       NOT NULL DEFAULT false,
      is_active               BOOLEAN       NOT NULL DEFAULT true,
      created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
    )
  `);

  // booking.bookings — placeholder until M07
  await q.query(`
    CREATE TABLE IF NOT EXISTS booking.bookings (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id     UUID         NOT NULL,
      customer_id   UUID,
      type          VARCHAR(20)  NOT NULL,
      status        VARCHAR(30)  NOT NULL,
      scheduled_at  TIMESTAMPTZ  NOT NULL,
      vehicle_plate VARCHAR(20)  NOT NULL,
      vehicle_model VARCHAR(100),
      notes         TEXT,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
    )
  `);

  // booking.booking_lines — placeholder until M07
  await q.query(`
    CREATE TABLE IF NOT EXISTS booking.booking_lines (
      id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id             UUID          NOT NULL,
      booking_id            UUID          NOT NULL,
      service_id            UUID          NOT NULL,
      price_amount          NUMERIC(10,2) NOT NULL,
      price_currency        VARCHAR(10)   NOT NULL DEFAULT 'BRL',
      loyalty_points_earned INTEGER       NOT NULL DEFAULT 0
    )
  `);

  // loyalty.loyalty_entries — placeholder until M10
  await q.query(`
    CREATE TABLE IF NOT EXISTS loyalty.loyalty_entries (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id        UUID        NOT NULL,
      customer_id      UUID        NOT NULL,
      booking_id       UUID        NOT NULL,
      booking_line_id  UUID        NOT NULL,
      points           INTEGER     NOT NULL,
      expires_at       TIMESTAMPTZ NOT NULL,
      earned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_loyalty_entries_tenant_line" UNIQUE (tenant_id, booking_line_id)
    )
  `);
}

// ── Seed functions ────────────────────────────────────────────────────────────

async function seedTenants(q: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  const settings = JSON.stringify(TENANT_SETTINGS);
  await q.query(
    `INSERT INTO platform.tenants (id, name, slug, settings, is_active) VALUES
      ($1, 'Lavacar BeloAuto', 'lavacar-beloauto', $3, true),
      ($2, 'AutoSpa Premium',  'autospa-premium',  $3, true)
    ON CONFLICT (id) DO NOTHING`,
    [IDS.tenantA, IDS.tenantB, settings],
  );
}

async function seedHotsites(q: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  const brandingA = JSON.stringify({ primaryColor: '#0055A4', logoUrl: null });
  const brandingB = JSON.stringify({ primaryColor: '#C8102E', logoUrl: null });
  const layoutA = JSON.stringify([
    { type: 'HERO', order: 1 },
    { type: 'SERVICE_LIST', order: 2 },
    { type: 'BOOKING_CTA', order: 3 },
  ]);
  const layoutB = JSON.stringify([
    { type: 'HERO', order: 1 },
    { type: 'SERVICE_LIST', order: 2 },
  ]);

  await q.query(
    `INSERT INTO platform.hotsite_configs (id, tenant_id, branding, layout, is_published) VALUES
      ($1, $3, $5, $7, true),
      ($2, $4, $6, $8, true)
    ON CONFLICT (id) DO NOTHING`,
    [IDS.hotsiteA, IDS.hotsiteB, IDS.tenantA, IDS.tenantB, brandingA, brandingB, layoutA, layoutB],
  );
}

async function seedStaff(q: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  await q.query(
    `INSERT INTO staff.staff (id, tenant_id, email, role, google_oauth_id, is_active) VALUES
      ($1, $4, 'admin@lavacar.com.br',       'MANAGER', 'google-sub-admin-a',  true),
      ($2, $4, 'funcionario@lavacar.com.br', 'STAFF',   'google-sub-worker-a', true),
      ($3, $5, 'admin@autospa.com.br',       'MANAGER', 'google-sub-admin-b',  true)
    ON CONFLICT (id) DO NOTHING`,
    [IDS.staffAdminA, IDS.staffWorkerA, IDS.staffAdminB, IDS.tenantA, IDS.tenantB],
  );
}

async function seedCustomers(q: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  await q.query(
    `INSERT INTO customer.customers
      (id, tenant_id, google_oauth_id, email, name, phone, default_address) VALUES
      ($1, $3, 'google-sub-customer-a', 'cliente@email.com.br', 'Cliente Teste', NULL, NULL),
      ($2, $4, 'google-sub-customer-a', 'cliente@email.com.br', 'Cliente Teste', NULL, NULL)
    ON CONFLICT (id) DO NOTHING`,
    [IDS.customerA1, IDS.customerA2, IDS.tenantA, IDS.tenantB],
  );
}

async function seedServices(q: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  await q.query(
    `INSERT INTO booking.services
      (id, tenant_id, name, price_amount, duration_minutes, loyalty_points, requires_pickup_address) VALUES
      ($1, $5, 'Lavagem Simples',       80.00,  30,  5,  false),
      ($2, $5, 'Lavagem Completa',     150.00,  60,  10, false),
      ($3, $5, 'Polimento',            350.00, 120,  25, true),
      ($4, $6, 'Higienização Interna', 200.00,  90,  15, false)
    ON CONFLICT (id) DO NOTHING`,
    [
      IDS.serviceSimples,
      IDS.serviceCompleta,
      IDS.servicePolimento,
      IDS.serviceHigienizacao,
      IDS.tenantA,
      IDS.tenantB,
    ],
  );
}

async function seedBookings(q: ReturnType<DataSource['createQueryRunner']>): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  lastWeek.setHours(10, 0, 0, 0);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 180);

  await q.query(
    `INSERT INTO booking.bookings
      (id, tenant_id, customer_id, type, status, scheduled_at, vehicle_plate) VALUES
      ($1, $4, $7, 'CUSTOMER', 'PENDING',   NOW() + INTERVAL '2 days', 'ABC-1234'),
      ($2, $4, $7, 'CUSTOMER', 'APPROVED',  $5,                         'DEF-5678'),
      ($3, $4, $7, 'CUSTOMER', 'COMPLETED', $6,                         'GHI-9012')
    ON CONFLICT (id) DO NOTHING`,
    [
      IDS.bookingPending,
      IDS.bookingApproved,
      IDS.bookingCompleted,
      IDS.tenantA,
      tomorrow.toISOString(),
      lastWeek.toISOString(),
      IDS.customerA1,
    ],
  );

  await q.query(
    `INSERT INTO booking.booking_lines
      (id, tenant_id, booking_id, service_id, price_amount, loyalty_points_earned) VALUES
      ($1, $2, $3, $4, 150.00, 10)
    ON CONFLICT (id) DO NOTHING`,
    [IDS.lineCompleted, IDS.tenantA, IDS.bookingCompleted, IDS.serviceCompleta],
  );

  await q.query(
    `INSERT INTO loyalty.loyalty_entries
      (id, tenant_id, customer_id, booking_id, booking_line_id, points, expires_at) VALUES
      ($1, $2, $3, $4, $5, 10, $6)
    ON CONFLICT (id) DO NOTHING`,
    [
      IDS.loyaltyEntry,
      IDS.tenantA,
      IDS.customerA1,
      IDS.bookingCompleted,
      IDS.lineCompleted,
      expiresAt.toISOString(),
    ],
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary(): void {
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    '║                    BeloAuto Seed — Done                      ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  Tenant A  │ Lavacar BeloAuto   │ lavacar-beloauto           ║',
    '║  Tenant B  │ AutoSpa Premium    │ autospa-premium            ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  Staff     │ admin@lavacar.com.br       (MANAGER, Tenant A)  ║',
    '║            │ funcionario@lavacar.com.br (STAFF,   Tenant A)  ║',
    '║            │ admin@autospa.com.br       (MANAGER, Tenant B)  ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  Customer  │ cliente@email.com.br (exists in both tenants)   ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  OAuth IDs │ google-sub-admin-a    (MANAGER, Tenant A)       ║',
    '║            │ google-sub-worker-a   (STAFF,   Tenant A)       ║',
    '║            │ google-sub-admin-b    (MANAGER, Tenant B)       ║',
    '║            │ google-sub-customer-a (CUSTOMER, both tenants)  ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  Bookings  │ 1 PENDING, 1 APPROVED (tomorrow), 1 COMPLETED   ║',
    '║            │ Loyalty: 10 pts earned on COMPLETED booking      ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
  ];
  lines.forEach((l) => process.stdout.write(l + '\n'));
}

seed().catch((err: unknown) => {
  process.stderr.write(`Seed failed: ${String(err)}\n`);
  process.exit(1);
});
