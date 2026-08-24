"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Minus, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Field, Skeleton } from "@/components/ui";
import { api_client, ApiClientError } from "@/lib/api_client";
import { format_idr, normalize_whatsapp } from "@/lib/format";
import type { PublicEventData } from "./event_landing";

type FormData = { form_fields: any[] };

export function RegistrationWizard({
  tenant_slug,
  event_slug,
}: {
  tenant_slug: string;
  event_slug: string;
}) {
  const router = useRouter();
  const idempotency = useRef(crypto.randomUUID());
  const event_query = useQuery({
    queryKey: ["public-event", tenant_slug, event_slug],
    queryFn: () =>
      api_client<PublicEventData>(
        `/public/events/${tenant_slug}/${event_slug}`,
      ),
  });
  const form_query = useQuery({
    queryKey: ["public-form", tenant_slug, event_slug],
    queryFn: () =>
      api_client<FormData>(`/public/events/${tenant_slug}/${event_slug}/form`),
  });
  const [step, set_step] = useState(0);
  const [tickets, set_tickets] = useState<Record<string, number>>({});
  const [addons, set_addons] = useState<
    Record<string, { quantity: number; option?: string }>
  >({});
  const [person, set_person] = useState({
    full_name: "",
    whatsapp_number: "",
    email: "",
  });
  const [answers, set_answers] = useState<Record<string, unknown>>({});
  const [accepted, set_accepted] = useState(false);
  const [submitting, set_submitting] = useState(false);
  if (event_query.isLoading || form_query.isLoading)
    return (
      <main className="mx-auto max-w-5xl px-5 py-12">
        <Skeleton className="h-[36rem]" />
      </main>
    );
  const data = event_query.data?.data;
  if (!data) return null;
  const selected_tickets = data.ticket_types.filter(
    (ticket) => (tickets[ticket.id] ?? 0) > 0,
  );
  const selected_addons = data.add_ons.filter(
    (item) => (addons[item.id]?.quantity ?? 0) > 0,
  );
  const total =
    selected_tickets.reduce(
      (sum, item) => sum + Number(item.price) * tickets[item.id],
      0,
    ) +
    selected_addons.reduce((sum, item) => {
      const state = addons[item.id];
      const option = item.options.find(
        (entry: any) => entry.id === state.option,
      );
      return (
        sum +
        (Number(item.price) + Number(option?.priceAdjustment ?? 0)) *
          state.quantity
      );
    }, 0);
  const custom_fields = (form_query.data?.data.form_fields ?? []).filter(
    (field) => !field.isSystem,
  );
  function ticket_count(id: string, delta: number, max: number) {
    set_tickets((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(max, (current[id] ?? 0) + delta)),
    }));
  }
  function validate_step() {
    if (step === 0 && !selected_tickets.length) {
      toast.error("Pilih minimal satu tiket");
      return false;
    }
    if (
      step === 2 &&
      (!person.full_name || !person.email || !person.whatsapp_number)
    ) {
      toast.error("Lengkapi data wajib");
      return false;
    }
    return true;
  }
  async function submit() {
    if (!accepted) {
      toast.error("Setujui syarat dan kebijakan");
      return;
    }
    set_submitting(true);
    try {
      const response = await api_client<any>(
        `/public/events/${tenant_slug}/${event_slug}/registrations`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotency.current },
          body: JSON.stringify({
            full_name: person.full_name,
            email: person.email,
            whatsapp_number: normalize_whatsapp(person.whatsapp_number),
            items: selected_tickets.map((ticket) => ({
              ticket_type_id: ticket.id,
              quantity: tickets[ticket.id],
            })),
            add_ons: selected_addons.map((item) => ({
              add_on_id: item.id,
              add_on_option_id: addons[item.id].option,
              quantity: addons[item.id].quantity,
            })),
            answers: custom_fields
              .filter((field) => answers[field.id] !== undefined)
              .map((field) => ({
                form_field_id: field.id,
                value: answers[field.id],
              })),
          }),
        },
      );
      const registration = response.data.registration;
      if (Number(registration.total_amount) > 0) {
        await api_client(
          `/public/registrations/${registration.registration_code}/payments/qris`,
          { method: "POST", body: "{}" },
        );
        router.push(
          `/e/${tenant_slug}/${event_slug}/payment/${registration.registration_code}`,
        );
      } else {
        const ticket = response.data.tickets[0];
        toast.success("Pendaftaran berhasil");
        router.push(
          `/ticket/${ticket.ticket_code}?token=${encodeURIComponent(ticket.qr_token)}`,
        );
      }
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Pendaftaran gagal",
      );
    } finally {
      set_submitting(false);
    }
  }
  const steps = ["Tiket", "Add-on", "Data peserta", "Tinjau"];
  return (
    <main className="relative mx-auto min-h-screen max-w-6xl px-4 py-5 sm:px-8">
      <div className="glass sticky top-3 z-30 mb-5 flex items-center justify-between rounded-[1.35rem] px-3 py-2.5">
        <button
          onClick={() => (step ? set_step(step - 1) : router.back())}
          className="button-secondary min-h-10 rounded-xl px-3"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </button>
        <p className="max-w-[55%] truncate text-sm font-black tracking-tight">
          {data.event.name}
        </p>
      </div>
      <div className="surface mb-5 grid grid-cols-4 gap-1.5 p-2">
        {steps.map((label, index) => (
          <div
            key={label}
            className={`rounded-2xl px-2 py-3 text-center text-[10px] font-black uppercase tracking-wide transition ${index <= step ? "bg-moss-600 text-white shadow-lg" : "text-stone-400"}`}
          >
            <span className="mr-1">{index + 1}.</span>{" "}
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <section className="surface min-h-[32rem] p-5 sm:p-8">
          {step === 0 ? (
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-black tracking-[-.04em]">
                Pilih tiket
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                Kuota final tetap diperiksa backend saat pendaftaran dikirim.
              </p>
              <div className="mt-7 space-y-3">
                {data.ticket_types.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`rounded-[1.35rem] border p-5 transition ${tickets[ticket.id] ? "border-moss-500 bg-moss-50 shadow-sm" : "border-stone-100 bg-white/50 hover:border-moss-100"}`}
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-bold">{ticket.name}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {ticket.description}
                        </p>
                      </div>
                      <p className="font-bold">
                        {Number(ticket.price)
                          ? format_idr(ticket.price)
                          : "Gratis"}
                      </p>
                    </div>
                    <div className="mt-5 flex items-center justify-end gap-3">
                      <button
                        onClick={() =>
                          ticket_count(ticket.id, -1, ticket.maxPerOrder)
                        }
                        className="grid size-9 place-items-center rounded-xl border bg-white"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="w-8 text-center font-bold">
                        {tickets[ticket.id] ?? 0}
                      </span>
                      <button
                        onClick={() =>
                          ticket_count(ticket.id, 1, ticket.maxPerOrder)
                        }
                        className="grid size-9 place-items-center rounded-xl border bg-white"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {step === 1 ? (
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-black tracking-[-.04em]">
                Tambahan event
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                Pilih kebutuhan tambahan yang Anda inginkan.
              </p>
              <div className="mt-7 space-y-3">
                {data.add_ons.length ? (
                  data.add_ons.map((item) => {
                    const state = addons[item.id] ?? { quantity: 0 };
                    return (
                      <div
                        key={item.id}
                        className="rounded-[1.35rem] border border-stone-100 bg-white/50 p-5 transition hover:border-moss-100"
                      >
                        <div className="flex justify-between">
                          <div>
                            <p className="font-bold">
                              {item.name}
                              {item.isRequired ? " *" : ""}
                            </p>
                            <p className="text-sm text-stone-500">
                              {item.description}
                            </p>
                          </div>
                          <p className="font-bold">{format_idr(item.price)}</p>
                        </div>
                        {item.options.length ? (
                          <select
                            className="input mt-4"
                            value={state.option ?? ""}
                            onChange={(e) =>
                              set_addons({
                                ...addons,
                                [item.id]: {
                                  ...state,
                                  option: e.target.value,
                                  quantity: Math.max(1, state.quantity),
                                },
                              })
                            }
                          >
                            <option value="">Pilih opsi</option>
                            {item.options.map((option: any) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                                {Number(option.priceAdjustment)
                                  ? ` (+${format_idr(option.priceAdjustment)})`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <div className="mt-4 flex items-center justify-end gap-3">
                          <button
                            onClick={() =>
                              set_addons({
                                ...addons,
                                [item.id]: {
                                  ...state,
                                  quantity: Math.max(0, state.quantity - 1),
                                },
                              })
                            }
                            className="grid size-9 place-items-center rounded-xl border"
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="w-8 text-center font-bold">
                            {state.quantity}
                          </span>
                          <button
                            onClick={() =>
                              set_addons({
                                ...addons,
                                [item.id]: {
                                  ...state,
                                  quantity: Math.min(
                                    item.maxQuantity,
                                    state.quantity + 1,
                                  ),
                                },
                              })
                            }
                            className="grid size-9 place-items-center rounded-xl border"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl bg-stone-50 p-5 text-sm text-stone-500">
                    Event ini tidak memiliki add-on.
                  </p>
                )}
              </div>
            </div>
          ) : null}
          {step === 2 ? (
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-black tracking-[-.04em]">
                Data peserta
              </h1>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <Field label="Nama lengkap *">
                  <input
                    className="input"
                    value={person.full_name}
                    onChange={(e) =>
                      set_person({ ...person, full_name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Nomor WhatsApp *">
                  <input
                    className="input"
                    inputMode="tel"
                    value={person.whatsapp_number}
                    onChange={(e) =>
                      set_person({ ...person, whatsapp_number: e.target.value })
                    }
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Email *">
                    <input
                      className="input"
                      type="email"
                      value={person.email}
                      onChange={(e) =>
                        set_person({ ...person, email: e.target.value })
                      }
                    />
                  </Field>
                </div>
                {custom_fields.map((field) => (
                  <div
                    key={field.id}
                    className={
                      field.fieldType === "textarea" ? "sm:col-span-2" : ""
                    }
                  >
                    <Field
                      label={`${field.label}${field.isRequired ? " *" : ""}`}
                      hint={field.helpText}
                    >
                      {["select", "radio"].includes(field.fieldType) ? (
                        <select
                          className="input"
                          value={String(answers[field.id] ?? "")}
                          onChange={(e) =>
                            set_answers({
                              ...answers,
                              [field.id]: e.target.value,
                            })
                          }
                        >
                          <option value="">Pilih</option>
                          {field.options.map((option: any) => (
                            <option key={option.id} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : field.fieldType === "textarea" ? (
                        <textarea
                          className="input min-h-28"
                          value={String(answers[field.id] ?? "")}
                          onChange={(e) =>
                            set_answers({
                              ...answers,
                              [field.id]: e.target.value,
                            })
                          }
                        />
                      ) : (
                        <input
                          className="input"
                          type={
                            field.fieldType === "number"
                              ? "number"
                              : field.fieldType === "date"
                                ? "date"
                                : "text"
                          }
                          value={String(answers[field.id] ?? "")}
                          onChange={(e) =>
                            set_answers({
                              ...answers,
                              [field.id]: e.target.value,
                            })
                          }
                        />
                      )}
                    </Field>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {step === 3 ? (
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-black tracking-[-.04em]">
                Tinjau pendaftaran
              </h1>
              <div className="mt-7 space-y-5">
                <Review
                  label="Peserta"
                  value={`${person.full_name} · ${person.email}`}
                />
                <Review
                  label="Tiket"
                  value={selected_tickets
                    .map((item) => `${item.name} × ${tickets[item.id]}`)
                    .join(", ")}
                />
                <Review
                  label="Add-on"
                  value={
                    selected_addons.length
                      ? selected_addons
                          .map(
                            (item) =>
                              `${item.name} × ${addons[item.id].quantity}`,
                          )
                          .join(", ")
                      : "Tidak ada"
                  }
                />
                <label className="flex gap-3 rounded-xl border border-moss-100 bg-moss-50 p-4 text-sm leading-6">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => set_accepted(e.target.checked)}
                    className="mt-1 rounded border-moss-300 text-moss-600 focus:ring-moss-500"
                  />
                  <span>
                    Saya menyetujui syarat event dan kebijakan privasi yang
                    ditampilkan penyelenggara.
                  </span>
                </label>
              </div>
            </div>
          ) : null}
          <div className="mt-8 flex justify-end">
            {step < 3 ? (
              <Button onClick={() => validate_step() && set_step(step + 1)}>
                Lanjut <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button loading={submitting} onClick={submit}>
                <ShieldCheck className="size-4" />
                Kirim pendaftaran
              </Button>
            )}
          </div>
        </section>
        <aside className="surface h-fit overflow-hidden p-5 xl:sticky xl:top-24">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-moss-600">
            Order summary
          </p>
          <div className="mt-5 space-y-3 text-sm">
            {selected_tickets.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.name} × {tickets[item.id]}
                </span>
                <span className="font-semibold">
                  {format_idr(Number(item.price) * tickets[item.id])}
                </span>
              </div>
            ))}
            {selected_addons.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.name} × {addons[item.id].quantity}
                </span>
                <span className="font-semibold">
                  {format_idr(Number(item.price) * addons[item.id].quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="-mx-5 -mb-5 mt-5 flex justify-between bg-ink px-5 py-5 text-white">
            <span className="font-black">Total</span>
            <span className="text-xl font-black text-amber-400">
              {format_idr(total)}
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}
function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-4">
      <p className="text-xs font-bold text-stone-400">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
