-- Forward-only reconciliation. Never edit the initial migration or remove existing records.
-- IF NOT EXISTS supports installations that adopted these fields before migrations existed.
BEGIN;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT 'LOCAL';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "paypalSubscriptionId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "interval" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "lastProviderEventAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'PROCESSED',
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "billing_orders" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerOrderId" TEXT,
  "plan" "PlanTier" NOT NULL,
  "interval" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "couponCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "providerPaymentId" TEXT,
  "subscriptionId" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_orders_pkey" PRIMARY KEY ("id")
);

-- Fail on incompatible pre-existing definitions instead of hiding drift or changing data.
DO $$
DECLARE
  expected RECORD;
  actual RECORD;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('users', 'provider', 'text', false),
    ('users', 'googleId', 'text', false),
    ('subscriptions', 'paypalSubscriptionId', 'text', false),
    ('subscriptions', 'interval', 'text', true),
    ('subscriptions', 'trialEndsAt', 'timestamp without time zone', false),
    ('subscriptions', 'lastProviderEventAt', 'timestamp without time zone', false),
    ('webhook_events', 'id', 'text', true),
    ('webhook_events', 'eventId', 'text', true),
    ('webhook_events', 'provider', 'text', true),
    ('webhook_events', 'eventType', 'text', true),
    ('webhook_events', 'payload', 'jsonb', false),
    ('webhook_events', 'processedAt', 'timestamp without time zone', true),
    ('webhook_events', 'status', 'text', true),
    ('billing_orders', 'id', 'text', true),
    ('billing_orders', 'userId', 'text', true),
    ('billing_orders', 'provider', 'text', true),
    ('billing_orders', 'providerOrderId', 'text', false),
    ('billing_orders', 'plan', '"PlanTier"', true),
    ('billing_orders', 'interval', 'text', true),
    ('billing_orders', 'amountMinor', 'integer', true),
    ('billing_orders', 'currency', 'text', true),
    ('billing_orders', 'couponCode', 'text', false),
    ('billing_orders', 'status', 'text', true),
    ('billing_orders', 'providerPaymentId', 'text', false),
    ('billing_orders', 'subscriptionId', 'text', false),
    ('billing_orders', 'paidAt', 'timestamp without time zone', false),
    ('billing_orders', 'createdAt', 'timestamp without time zone', true),
    ('billing_orders', 'updatedAt', 'timestamp without time zone', true)
  ) AS fields(table_name, column_name, type_name, not_null) LOOP
    SELECT format_type(a.atttypid, NULL) AS type_name, a.attnotnull AS not_null, a.atttypmod AS precision
      INTO actual
      FROM pg_attribute a
      WHERE a.attrelid = to_regclass(format('%I', expected.table_name))
        AND a.attname = expected.column_name AND NOT a.attisdropped;
    IF actual IS NULL OR actual.type_name <> expected.type_name OR actual.not_null <> expected.not_null THEN
      RAISE EXCEPTION 'Incompatible schema for %.%; reconcile definitions explicitly before deployment', expected.table_name, expected.column_name;
    END IF;
    IF expected.type_name = 'timestamp without time zone' AND actual.precision <> 3 THEN
      RAISE EXCEPTION 'Incompatible timestamp precision for %.%', expected.table_name, expected.column_name;
    END IF;
  END LOOP;
END $$;

-- Setting defaults affects future inserts only; existing values are preserved.
ALTER TABLE "users" ALTER COLUMN "provider" SET DEFAULT 'LOCAL';
ALTER TABLE "subscriptions" ALTER COLUMN "interval" SET DEFAULT 'monthly';
ALTER TABLE "webhook_events" ALTER COLUMN "processedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "webhook_events" ALTER COLUMN "status" SET DEFAULT 'PROCESSED';
ALTER TABLE "billing_orders" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "billing_orders" ALTER COLUMN "status" SET DEFAULT 'CREATED';

-- Conflicting values cause a safe migration failure; no automatic deduplication is performed.
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_paypalSubscriptionId_key" ON "subscriptions"("paypalSubscriptionId");
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_eventId_key" ON "webhook_events"("eventId");
CREATE INDEX IF NOT EXISTS "webhook_events_eventId_idx" ON "webhook_events"("eventId");
CREATE INDEX IF NOT EXISTS "webhook_events_provider_idx" ON "webhook_events"("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_orders_provider_providerOrderId_key" ON "billing_orders"("provider", "providerOrderId");
CREATE INDEX IF NOT EXISTS "billing_orders_userId_idx" ON "billing_orders"("userId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'billing_orders'::regclass AND conname = 'billing_orders_userId_fkey') THEN
    ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- An identically named but incompatible index must not defeat uniqueness or conceal drift.
DO $$
DECLARE
  expected RECORD;
  actual RECORD;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('users', 'users_googleId_key', 'googleId', true),
    ('subscriptions', 'subscriptions_paypalSubscriptionId_key', 'paypalSubscriptionId', true),
    ('webhook_events', 'webhook_events_eventId_key', 'eventId', true),
    ('webhook_events', 'webhook_events_eventId_idx', 'eventId', false),
    ('webhook_events', 'webhook_events_provider_idx', 'provider', false),
    ('billing_orders', 'billing_orders_provider_providerOrderId_key', 'provider,providerOrderId', true),
    ('billing_orders', 'billing_orders_userId_idx', 'userId', false)
  ) AS indexes(table_name, index_name, column_names, is_unique) LOOP
    SELECT i.indrelid AS table_oid, i.indisunique AS is_unique, i.indisvalid AS is_valid,
      i.indpred IS NULL AND i.indexprs IS NULL AS is_simple,
      (SELECT string_agg(a.attname, ',' ORDER BY k.position)
        FROM unnest(i.indkey) WITH ORDINALITY AS k(number, position)
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.number) AS column_names
    INTO actual FROM pg_index i WHERE i.indexrelid = to_regclass(format('%I', expected.index_name));
    IF actual IS NULL OR actual.table_oid <> to_regclass(format('%I', expected.table_name))
      OR actual.is_unique <> expected.is_unique OR NOT actual.is_valid OR NOT actual.is_simple
      OR actual.column_names <> expected.column_names THEN
      RAISE EXCEPTION 'Incompatible index %; reconcile explicitly before deployment', expected.index_name;
    END IF;
  END LOOP;
END $$;

COMMIT;
