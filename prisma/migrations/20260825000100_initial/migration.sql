-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "whatsapp_number" VARCHAR(32),
    "password_hash" TEXT NOT NULL,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "logo_url" TEXT,
    "primary_color" VARCHAR(16),
    "email" VARCHAR(320),
    "whatsapp_number" VARCHAR(32),
    "address" TEXT,
    "custom_domain" VARCHAR(255),
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "settings_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(32) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "short_description" VARCHAR(500),
    "description" TEXT,
    "banner_url" TEXT,
    "location_type" VARCHAR(24) NOT NULL DEFAULT 'offline',
    "location_name" VARCHAR(200),
    "location_address" TEXT,
    "meeting_url" TEXT,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    "registration_start_at" TIMESTAMPTZ(3) NOT NULL,
    "registration_end_at" TIMESTAMPTZ(3) NOT NULL,
    "capacity" INTEGER,
    "organizer_name" VARCHAR(160),
    "organizer_contact" VARCHAR(160),
    "terms_text" TEXT,
    "privacy_text" TEXT,
    "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(3),
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."event_staff_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "quota" INTEGER,
    "min_per_order" INTEGER NOT NULL DEFAULT 1,
    "max_per_order" INTEGER NOT NULL DEFAULT 10,
    "sale_start_at" TIMESTAMPTZ(3),
    "sale_end_at" TIMESTAMPTZ(3),
    "visibility" VARCHAR(24) NOT NULL DEFAULT 'public',
    "access_code_hash" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."add_ons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "quota" INTEGER,
    "selection_type" VARCHAR(24) NOT NULL DEFAULT 'quantity',
    "min_quantity" INTEGER NOT NULL DEFAULT 0,
    "max_quantity" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."add_on_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "add_on_id" UUID NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "value" VARCHAR(120) NOT NULL,
    "price_adjustment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "quota" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "add_on_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_type_add_ons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "add_on_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_type_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "ticket_type_id" UUID,
    "field_key" VARCHAR(80) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "field_type" VARCHAR(32) NOT NULL,
    "placeholder" VARCHAR(255),
    "help_text" TEXT,
    "default_value_json" JSONB,
    "validation_json" JSONB,
    "conditional_logic_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."form_field_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "form_field_id" UUID NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "value" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "form_field_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "registration_code" VARCHAR(40) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "whatsapp_number" VARCHAR(32) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "subtotal_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "add_on_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "idempotency_key" VARCHAR(160) NOT NULL,
    "source" VARCHAR(24) NOT NULL DEFAULT 'web',
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registration_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "ticket_type_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "total_price" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registration_add_ons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "add_on_id" UUID NOT NULL,
    "add_on_option_id" UUID,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,2) NOT NULL,
    "total_price" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registration_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "form_field_id" UUID NOT NULL,
    "answer_json" JSONB NOT NULL,
    "field_snapshot_json" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "registration_item_id" UUID NOT NULL,
    "ticket_code" VARCHAR(48) NOT NULL,
    "qr_token_hash" VARCHAR(128) NOT NULL,
    "holder_name" VARCHAR(160) NOT NULL,
    "holder_email" VARCHAR(320) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'issued',
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."check_ins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "checked_in_by" UUID NOT NULL,
    "checked_in_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(24) NOT NULL DEFAULT 'web',
    "device_id" VARCHAR(160),
    "sync_key" VARCHAR(160) NOT NULL,
    "notes" TEXT,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "provider" VARCHAR(24) NOT NULL DEFAULT 'xendit',
    "account_mode" VARCHAR(24) NOT NULL DEFAULT 'platform',
    "environment" VARCHAR(16) NOT NULL DEFAULT 'test',
    "business_id" VARCHAR(160),
    "secret_api_key_encrypted" TEXT NOT NULL,
    "webhook_token_encrypted" TEXT NOT NULL,
    "api_version" VARCHAR(24) NOT NULL DEFAULT '2024-11-11',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "provider" VARCHAR(24) NOT NULL DEFAULT 'xendit',
    "payment_method" VARCHAR(32) NOT NULL DEFAULT 'QRIS',
    "reference_id" VARCHAR(160) NOT NULL,
    "provider_payment_request_id" VARCHAR(160),
    "provider_payment_id" VARCHAR(160),
    "provider_business_id" VARCHAR(160),
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "failure_code" VARCHAR(120),
    "qr_string_encrypted" TEXT,
    "qr_expires_at" TIMESTAMPTZ(3),
    "provider_created_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "expired_at" TIMESTAMPTZ(3),
    "last_checked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "provider" VARCHAR(24) NOT NULL DEFAULT 'xendit',
    "event_name" VARCHAR(120) NOT NULL,
    "provider_event_key" VARCHAR(255) NOT NULL,
    "provider_payment_id" VARCHAR(160),
    "provider_payment_request_id" VARCHAR(160),
    "reference_id" VARCHAR(160),
    "payload_json" JSONB NOT NULL,
    "headers_json_masked" JSONB NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'received',
    "processing_error" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "actor_user_id" UUID,
    "actor_role" VARCHAR(32),
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID,
    "before_json" JSONB,
    "after_json" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by_id" UUID,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_status_idx" ON "public"."users"("status");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "public"."tenants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "public"."tenants"("slug");

-- CreateIndex
CREATE INDEX "tenant_users_tenant_id_status_idx" ON "public"."tenant_users"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tenant_users_user_id_status_idx" ON "public"."tenant_users"("user_id", "status");

-- CreateIndex
CREATE INDEX "events_tenant_id_status_idx" ON "public"."events"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "events_tenant_id_created_at_idx" ON "public"."events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "event_staff_assignments_user_id_idx" ON "public"."event_staff_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_staff_assignments_tenant_id_event_id_user_id_key" ON "public"."event_staff_assignments"("tenant_id", "event_id", "user_id");

-- CreateIndex
CREATE INDEX "ticket_types_tenant_id_event_id_is_active_idx" ON "public"."ticket_types"("tenant_id", "event_id", "is_active");

-- CreateIndex
CREATE INDEX "add_ons_tenant_id_event_id_is_active_idx" ON "public"."add_ons"("tenant_id", "event_id", "is_active");

-- CreateIndex
CREATE INDEX "add_on_options_tenant_id_add_on_id_is_active_idx" ON "public"."add_on_options"("tenant_id", "add_on_id", "is_active");

-- CreateIndex
CREATE INDEX "ticket_type_add_ons_add_on_id_idx" ON "public"."ticket_type_add_ons"("add_on_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_type_add_ons_tenant_id_ticket_type_id_add_on_id_key" ON "public"."ticket_type_add_ons"("tenant_id", "ticket_type_id", "add_on_id");

-- CreateIndex
CREATE INDEX "form_fields_tenant_id_event_id_is_active_idx" ON "public"."form_fields"("tenant_id", "event_id", "is_active");

-- CreateIndex
CREATE INDEX "form_field_options_tenant_id_form_field_id_is_active_idx" ON "public"."form_field_options"("tenant_id", "form_field_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_registration_code_key" ON "public"."registrations"("registration_code");

-- CreateIndex
CREATE INDEX "registrations_tenant_id_event_id_status_idx" ON "public"."registrations"("tenant_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "registrations_tenant_id_event_id_email_idx" ON "public"."registrations"("tenant_id", "event_id", "email");

-- CreateIndex
CREATE INDEX "registrations_tenant_id_event_id_whatsapp_number_idx" ON "public"."registrations"("tenant_id", "event_id", "whatsapp_number");

-- CreateIndex
CREATE INDEX "registrations_tenant_id_created_at_idx" ON "public"."registrations"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_tenant_id_event_id_idempotency_key_key" ON "public"."registrations"("tenant_id", "event_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "registration_items_tenant_id_registration_id_idx" ON "public"."registration_items"("tenant_id", "registration_id");

-- CreateIndex
CREATE INDEX "registration_items_ticket_type_id_idx" ON "public"."registration_items"("ticket_type_id");

-- CreateIndex
CREATE INDEX "registration_add_ons_tenant_id_registration_id_idx" ON "public"."registration_add_ons"("tenant_id", "registration_id");

-- CreateIndex
CREATE INDEX "registration_add_ons_add_on_id_idx" ON "public"."registration_add_ons"("add_on_id");

-- CreateIndex
CREATE INDEX "registration_answers_tenant_id_registration_id_idx" ON "public"."registration_answers"("tenant_id", "registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_answers_registration_id_form_field_id_key" ON "public"."registration_answers"("registration_id", "form_field_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_code_key" ON "public"."tickets"("ticket_code");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qr_token_hash_key" ON "public"."tickets"("qr_token_hash");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_event_id_status_idx" ON "public"."tickets"("tenant_id", "event_id", "status");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_created_at_idx" ON "public"."tickets"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_sync_key_key" ON "public"."check_ins"("sync_key");

-- CreateIndex
CREATE INDEX "check_ins_tenant_id_event_id_checked_in_at_idx" ON "public"."check_ins"("tenant_id", "event_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "check_ins_tenant_id_ticket_id_idx" ON "public"."check_ins"("tenant_id", "ticket_id");

-- CreateIndex
CREATE INDEX "payment_configs_tenant_id_is_active_idx" ON "public"."payment_configs"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_id_key" ON "public"."payments"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_request_id_key" ON "public"."payments"("provider_payment_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "public"."payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_status_idx" ON "public"."payments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "payments_tenant_id_created_at_idx" ON "public"."payments"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_webhook_events_tenant_id_status_idx" ON "public"."payment_webhook_events"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "payment_webhook_events_reference_id_idx" ON "public"."payment_webhook_events"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_provider_event_key_key" ON "public"."payment_webhook_events"("provider", "provider_event_key");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "public"."audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "public"."audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "public"."auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "public"."password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "public"."password_reset_tokens"("user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "public"."tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_users" ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_users" ADD CONSTRAINT "tenant_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."event_staff_assignments" ADD CONSTRAINT "event_staff_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_types" ADD CONSTRAINT "ticket_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_types" ADD CONSTRAINT "ticket_types_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."add_ons" ADD CONSTRAINT "add_ons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."add_ons" ADD CONSTRAINT "add_ons_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."add_on_options" ADD CONSTRAINT "add_on_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."add_on_options" ADD CONSTRAINT "add_on_options_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "public"."add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_type_add_ons" ADD CONSTRAINT "ticket_type_add_ons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_type_add_ons" ADD CONSTRAINT "ticket_type_add_ons_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_type_add_ons" ADD CONSTRAINT "ticket_type_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "public"."add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_fields" ADD CONSTRAINT "form_fields_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_fields" ADD CONSTRAINT "form_fields_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_fields" ADD CONSTRAINT "form_fields_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_field_options" ADD CONSTRAINT "form_field_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."form_field_options" ADD CONSTRAINT "form_field_options_form_field_id_fkey" FOREIGN KEY ("form_field_id") REFERENCES "public"."form_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registrations" ADD CONSTRAINT "registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registrations" ADD CONSTRAINT "registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_items" ADD CONSTRAINT "registration_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_items" ADD CONSTRAINT "registration_items_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_items" ADD CONSTRAINT "registration_items_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_add_ons" ADD CONSTRAINT "registration_add_ons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_add_ons" ADD CONSTRAINT "registration_add_ons_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_add_ons" ADD CONSTRAINT "registration_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "public"."add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_add_ons" ADD CONSTRAINT "registration_add_ons_add_on_option_id_fkey" FOREIGN KEY ("add_on_option_id") REFERENCES "public"."add_on_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_answers" ADD CONSTRAINT "registration_answers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_answers" ADD CONSTRAINT "registration_answers_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."registration_answers" ADD CONSTRAINT "registration_answers_form_field_id_fkey" FOREIGN KEY ("form_field_id") REFERENCES "public"."form_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_registration_item_id_fkey" FOREIGN KEY ("registration_item_id") REFERENCES "public"."registration_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."check_ins" ADD CONSTRAINT "check_ins_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."check_ins" ADD CONSTRAINT "check_ins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."check_ins" ADD CONSTRAINT "check_ins_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."check_ins" ADD CONSTRAINT "check_ins_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."check_ins" ADD CONSTRAINT "check_ins_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_configs" ADD CONSTRAINT "payment_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints and partial indexes that Prisma cannot express directly.
CREATE UNIQUE INDEX "users_email_ci_active_unique"
ON "public"."users" (LOWER("email")) WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "tenant_users_active_unique"
ON "public"."tenant_users" ("tenant_id", "user_id") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "events_tenant_slug_active_unique"
ON "public"."events" ("tenant_id", "slug") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "ticket_types_event_slug_active_unique"
ON "public"."ticket_types" ("tenant_id", "event_id", "slug") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "add_ons_event_slug_active_unique"
ON "public"."add_ons" ("tenant_id", "event_id", "slug") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "form_fields_event_key_active_unique"
ON "public"."form_fields" ("tenant_id", "event_id", "field_key") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "check_ins_one_active_per_ticket"
ON "public"."check_ins" ("tenant_id", "ticket_id") WHERE "voided_at" IS NULL;

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_time_valid" CHECK ("start_at" < "end_at"),
  ADD CONSTRAINT "events_registration_time_valid" CHECK ("registration_start_at" < "registration_end_at"),
  ADD CONSTRAINT "events_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0),
  ADD CONSTRAINT "events_status_valid" CHECK ("status" IN ('draft', 'published', 'closed', 'archived'));

ALTER TABLE "public"."tenants"
  ADD CONSTRAINT "tenants_status_valid" CHECK ("status" IN ('active', 'inactive', 'suspended'));

ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_status_valid" CHECK ("status" IN ('active', 'inactive', 'invited', 'locked'));

ALTER TABLE "public"."tenant_users"
  ADD CONSTRAINT "tenant_users_role_valid" CHECK ("role" IN ('tenant_admin', 'event_staff'));

ALTER TABLE "public"."ticket_types"
  ADD CONSTRAINT "ticket_types_price_nonnegative" CHECK ("price" >= 0),
  ADD CONSTRAINT "ticket_types_quantity_valid" CHECK ("min_per_order" > 0 AND "max_per_order" >= "min_per_order"),
  ADD CONSTRAINT "ticket_types_visibility_valid" CHECK ("visibility" IN ('public', 'hidden', 'access_code'));

ALTER TABLE "public"."add_ons"
  ADD CONSTRAINT "add_ons_price_nonnegative" CHECK ("price" >= 0),
  ADD CONSTRAINT "add_ons_quantity_valid" CHECK ("min_quantity" >= 0 AND "max_quantity" >= "min_quantity");

ALTER TABLE "public"."add_on_options"
  ADD CONSTRAINT "add_on_options_quota_positive" CHECK ("quota" IS NULL OR "quota" > 0);

ALTER TABLE "public"."form_fields"
  ADD CONSTRAINT "form_fields_key_snake_case" CHECK ("field_key" ~ '^[a-z][a-z0-9_]*$');

ALTER TABLE "public"."registrations"
  ADD CONSTRAINT "registrations_amount_nonnegative" CHECK ("subtotal_amount" >= 0 AND "add_on_amount" >= 0 AND "total_amount" >= 0),
  ADD CONSTRAINT "registrations_status_valid" CHECK ("status" IN ('pending', 'pending_payment', 'confirmed', 'cancelled', 'expired', 'rejected'));

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "payments_status_valid" CHECK ("status" IN ('pending', 'requires_action', 'succeeded', 'failed', 'expired', 'refunded', 'partially_refunded'));

ALTER TABLE "public"."tickets"
  ADD CONSTRAINT "tickets_status_valid" CHECK ("status" IN ('issued', 'checked_in', 'cancelled', 'expired'));
