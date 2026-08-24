import { z } from "zod";

export const slug_schema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const uuid_schema = z.string().uuid();

export const login_schema = z
  .object({ email: z.email(), password: z.string().min(8) })
  .strict();
export const tenant_context_schema = z
  .object({ tenant_id: uuid_schema })
  .strict();
export const refresh_schema = z
  .object({ refresh_token: z.string().optional() })
  .strict();

export const tenant_schema = z
  .object({
    name: z.string().min(2).max(160),
    slug: slug_schema,
    email: z.email().optional(),
    whatsapp_number: z.string().max(32).optional(),
    address: z.string().max(2000).optional(),
    primary_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    custom_domain: z.string().max(255).optional(),
    admin_full_name: z.string().min(2).max(160),
    admin_email: z.email(),
    admin_password: z.string().min(12),
  })
  .strict();

export const tenant_update_schema = tenant_schema
  .omit({
    slug: true,
    admin_full_name: true,
    admin_email: true,
    admin_password: true,
  })
  .partial()
  .extend({ status: z.enum(["active", "inactive", "suspended"]).optional() })
  .strict();

export const tenant_user_schema = z
  .object({
    full_name: z.string().min(2).max(160),
    email: z.email(),
    whatsapp_number: z.string().max(32).optional(),
    role: z.enum(["tenant_admin", "event_staff"]),
    password: z.string().min(12),
  })
  .strict();

export const event_schema = z
  .object({
    name: z.string().min(2).max(200),
    slug: slug_schema,
    short_description: z.string().max(500).optional(),
    description: z.string().optional(),
    banner_url: z.url().optional().or(z.literal("")),
    location_type: z.enum(["offline", "online", "hybrid"]),
    location_name: z.string().max(200).optional(),
    location_address: z.string().optional(),
    meeting_url: z.url().optional().or(z.literal("")),
    start_at: z.iso.datetime(),
    end_at: z.iso.datetime(),
    timezone: z.string().min(1).max(64),
    registration_start_at: z.iso.datetime(),
    registration_end_at: z.iso.datetime(),
    capacity: z.coerce.number().int().positive().optional(),
    organizer_name: z.string().max(160).optional(),
    organizer_contact: z.string().max(160).optional(),
    terms_text: z.string().optional(),
    privacy_text: z.string().optional(),
  })
  .strict()
  .refine((value) => new Date(value.start_at) < new Date(value.end_at), {
    message: "Waktu selesai harus setelah waktu mulai",
    path: ["end_at"],
  })
  .refine(
    (value) =>
      new Date(value.registration_start_at) <
      new Date(value.registration_end_at),
    {
      message: "Periode pendaftaran tidak valid",
      path: ["registration_end_at"],
    },
  );

export const ticket_type_schema = z
  .object({
    name: z.string().min(1).max(160),
    slug: slug_schema,
    description: z.string().optional(),
    price: z.coerce.number().nonnegative(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("IDR"),
    quota: z.coerce.number().int().positive().optional(),
    min_per_order: z.coerce.number().int().positive().default(1),
    max_per_order: z.coerce.number().int().positive().default(10),
    visibility: z.enum(["public", "hidden", "access_code"]).default("public"),
    access_code: z.string().min(4).optional(),
    sort_order: z.coerce.number().int().default(0),
    is_active: z.boolean().default(true),
  })
  .strict()
  .refine((value) => value.max_per_order >= value.min_per_order, {
    path: ["max_per_order"],
    message: "Maksimal pembelian tidak valid",
  });

export const add_on_schema = z
  .object({
    name: z.string().min(1).max(160),
    slug: slug_schema,
    description: z.string().optional(),
    price: z.coerce.number().nonnegative(),
    quota: z.coerce.number().int().positive().optional(),
    selection_type: z.enum(["quantity", "single_option"]),
    min_quantity: z.coerce.number().int().nonnegative().default(0),
    max_quantity: z.coerce.number().int().positive().default(1),
    is_required: z.boolean().default(false),
    sort_order: z.coerce.number().int().default(0),
    is_active: z.boolean().default(true),
    ticket_type_ids: z.array(uuid_schema).optional(),
    options: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().regex(/^[a-zA-Z0-9_-]+$/),
          price_adjustment: z.coerce.number().default(0),
          quota: z.coerce.number().int().positive().optional(),
          sort_order: z.coerce.number().int().default(0),
        }),
      )
      .optional(),
  })
  .strict();

export const form_field_schema = z
  .object({
    ticket_type_id: uuid_schema.optional(),
    field_key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    label: z.string().min(1).max(160),
    field_type: z.enum([
      "text",
      "textarea",
      "email",
      "phone",
      "number",
      "date",
      "select",
      "radio",
      "checkbox",
      "file",
    ]),
    placeholder: z.string().optional(),
    help_text: z.string().optional(),
    validation_json: z.record(z.string(), z.unknown()).optional(),
    conditional_logic_json: z.record(z.string(), z.unknown()).optional(),
    sort_order: z.coerce.number().int().default(0),
    is_required: z.boolean().default(false),
    is_active: z.boolean().default(true),
    options: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
          sort_order: z.number().int().default(0),
        }),
      )
      .optional(),
  })
  .strict();

export const registration_schema = z
  .object({
    full_name: z.string().min(2).max(160),
    whatsapp_number: z.string().min(8).max(32),
    email: z.email(),
    items: z
      .array(
        z.object({
          ticket_type_id: uuid_schema,
          quantity: z.coerce.number().int().positive(),
          access_code: z.string().optional(),
        }),
      )
      .min(1),
    add_ons: z
      .array(
        z.object({
          add_on_id: uuid_schema,
          add_on_option_id: uuid_schema.optional(),
          quantity: z.coerce.number().int().positive(),
        }),
      )
      .optional(),
    answers: z
      .array(z.object({ form_field_id: uuid_schema, value: z.unknown() }))
      .optional(),
  })
  .strict();

export const manual_settlement_schema = z
  .object({
    payment_method: z.enum(["cash", "edc", "bank_transfer", "other"]),
    reference_number: z.string().trim().min(2).max(160).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export type LoginInput = z.infer<typeof login_schema>;
export type TenantInput = z.infer<typeof tenant_schema>;
export type EventInput = z.infer<typeof event_schema>;
export type RegistrationInput = z.infer<typeof registration_schema>;
export type ManualSettlementInput = z.infer<typeof manual_settlement_schema>;
