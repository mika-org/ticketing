ALTER TABLE "public"."payments"
ADD COLUMN "settled_by_user_id" UUID,
ADD COLUMN "manual_reference" VARCHAR(160),
ADD COLUMN "settlement_notes" TEXT;

CREATE INDEX "payments_settled_by_user_id_paid_at_idx"
ON "public"."payments"("settled_by_user_id", "paid_at");

CREATE UNIQUE INDEX "payments_one_manual_settlement_per_registration"
ON "public"."payments"("registration_id")
WHERE "provider" = 'manual' AND "status" = 'succeeded';

ALTER TABLE "public"."payments"
ADD CONSTRAINT "payments_settled_by_user_id_fkey"
FOREIGN KEY ("settled_by_user_id") REFERENCES "public"."users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."payments"
ADD CONSTRAINT "payments_manual_settlement_actor_check"
CHECK ("provider" <> 'manual' OR "status" <> 'succeeded' OR "settled_by_user_id" IS NOT NULL);
