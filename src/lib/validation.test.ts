import { describe, expect, it } from "vitest";
import {
  event_schema,
  manual_settlement_schema,
  registration_schema,
  ticket_type_schema,
} from "./validation";

describe("domain schemas", () => {
  it("rejects invalid event date ranges", () => {
    const result = event_schema.safeParse({
      name: "Event",
      slug: "event",
      location_type: "offline",
      start_at: "2026-08-25T12:00:00.000Z",
      end_at: "2026-08-25T10:00:00.000Z",
      timezone: "Asia/Jakarta",
      registration_start_at: "2026-08-20T10:00:00.000Z",
      registration_end_at: "2026-08-24T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
  it("rejects ticket maximum below minimum", () =>
    expect(
      ticket_type_schema.safeParse({
        name: "VIP",
        slug: "vip",
        price: 100000,
        quota: 10,
        min_per_order: 3,
        max_per_order: 1,
        visibility: "public",
        sort_order: 0,
        is_active: true,
      }).success,
    ).toBe(false));
  it("requires at least one ticket in registration", () =>
    expect(
      registration_schema.safeParse({
        full_name: "Participant",
        whatsapp_number: "628123456789",
        email: "p@example.com",
        items: [],
      }).success,
    ).toBe(false));
  it("accepts a valid manual OTS settlement", () =>
    expect(
      manual_settlement_schema.safeParse({
        payment_method: "cash",
        notes: "Dibayar di venue",
      }).success,
    ).toBe(true));
  it("rejects an unsupported manual settlement method", () =>
    expect(
      manual_settlement_schema.safeParse({ payment_method: "crypto" }).success,
    ).toBe(false));
});
