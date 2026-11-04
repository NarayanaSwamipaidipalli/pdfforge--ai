-- Additive authentication state. Existing accounts, credentials and records are preserved.
BEGIN;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='users' AND column_name='tokenVersion' AND data_type='integer' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'Incompatible users.tokenVersion; reconcile explicitly without resetting data';
  END IF;
END $$;
ALTER TABLE "users" ALTER COLUMN "tokenVersion" SET DEFAULT 0;
CREATE TABLE "oauth_states" (
  "id" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "userId" TEXT,
  "redirectUri" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_states_stateHash_key" ON "oauth_states"("stateHash");
CREATE INDEX "oauth_states_expiresAt_idx" ON "oauth_states"("expiresAt");
COMMIT;
