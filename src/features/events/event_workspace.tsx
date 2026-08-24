"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  Banknote,
  CalendarRange,
  Check,
  CircleDollarSign,
  Clipboard,
  CreditCard,
  Download,
  ExternalLink,
  Plus,
  QrCode,
  RefreshCcw,
  Send,
  Share2,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  EmptyState,
  Field,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui";
import { api_client } from "@/lib/api_client";
import { format_date, format_idr, mask_email } from "@/lib/format";

type EventRecord = {
  id: string;
  name: string;
  slug: string;
  status: string;
  startAt: string;
  endAt: string;
  timezone: string;
  locationName: string | null;
  shortDescription: string | null;
  _count: {
    registrations: number;
    tickets: number;
    ticketTypes: number;
    addOns: number;
  };
};

export function EventWorkspace({
  event_id,
  section = "detail",
}: {
  event_id: string;
  section?: string;
}) {
  const event = useQuery({
    queryKey: ["event", event_id],
    queryFn: () => api_client<{ event: EventRecord }>(`/events/${event_id}`),
  });
  const publish = useMutation({
    mutationFn: () =>
      api_client(`/events/${event_id}/publish`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      toast.success("Event dipublikasikan");
      void event.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (event.isLoading) return <Skeleton className="h-96" />;
  if (!event.data)
    return (
      <EmptyState
        title="Event tidak ditemukan"
        description="Periksa tenant context atau akses event Anda."
      />
    );
  const value = event.data.data.event;
  const tabs = [
    ["detail", "Ringkasan"],
    ["ticket-types", "Jenis tiket"],
    ["add-ons", "Add-on"],
    ["form-builder", "Form"],
    ["registrations", "Pendaftar"],
    ["reports", "Laporan"],
    ["check-in", "Check-in"],
  ];
  return (
    <div>
      <PageHeader
        eyebrow={`Event · ${value.slug}`}
        title={value.name}
        description={
          value.shortDescription ??
          "Workspace konfigurasi dan operasional event."
        }
        action={
          value.status !== "published" ? (
            <Button
              loading={publish.isPending}
              onClick={() => publish.mutate()}
            >
              <Send className="size-4" />
              Publikasikan
            </Button>
          ) : (
            <StatusBadge status="published" />
          )
        }
      />
      <nav className="glass mb-6 flex gap-1 overflow-x-auto rounded-[1.35rem] p-1.5">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={
              key === "detail"
                ? `/admin/events/${event_id}`
                : `/admin/events/${event_id}/${key}`
            }
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${section === key ? "bg-moss-600 text-white shadow-lg" : "text-stone-500 hover:bg-moss-50 hover:text-moss-700"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {section === "detail" ? <EventOverview event={value} /> : null}
      {section === "ticket-types" ? <TicketTypes event_id={event_id} /> : null}
      {section === "add-ons" ? <AddOns event_id={event_id} /> : null}
      {section === "form-builder" ? <FormBuilder event_id={event_id} /> : null}
      {section === "registrations" ? (
        <Registrations event_id={event_id} />
      ) : null}
      {section === "reports" ? <EventReports event_id={event_id} /> : null}
      {section === "check-in" ? <CheckIn event_id={event_id} /> : null}
    </div>
  );
}

function EventOverview({ event }: { event: EventRecord }) {
  const link = useQuery({
    queryKey: ["public-link", event.id],
    queryFn: () =>
      api_client<{ url: string }>(`/events/${event.id}/public-link`),
  });
  const url = link.data?.data.url;
  function copy() {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    toast.success("Link disalin");
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_.7fr]">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Pendaftar", event._count.registrations],
            ["Tiket", event._count.tickets],
            ["Jenis tiket", event._count.ticketTypes],
            ["Add-on", event._count.addOns],
          ].map(([label, value]) => (
            <div key={label} className="surface p-5">
              <p className="text-3xl font-bold">{value}</p>
              <p className="mt-1 text-xs font-semibold text-stone-500">
                {label}
              </p>
            </div>
          ))}
        </div>
        <div className="surface p-6">
          <h2 className="font-bold">Jadwal dan lokasi</h2>
          <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-stone-400">Mulai</p>
              <p className="mt-1 font-semibold">
                {format_date(event.startAt, event.timezone)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Selesai</p>
              <p className="mt-1 font-semibold">
                {format_date(event.endAt, event.timezone)}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Lokasi</p>
              <p className="mt-1 font-semibold">
                {event.locationName ?? "Online"}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Status</p>
              <div className="mt-1">
                <StatusBadge status={event.status} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="surface h-fit p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-moss-600">
          Link publik
        </p>
        {url ? (
          <>
            <div className="mx-auto mt-6 w-fit rounded-2xl border border-stone-100 bg-white p-3">
              <QRCodeSVG value={url} size={150} />
            </div>
            <p className="mt-5 break-all rounded-xl bg-stone-50 p-3 font-mono text-xs text-stone-500">
              {url}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={copy}>
                <Clipboard className="size-4" />
                Salin
              </Button>
              <a href={url} target="_blank" className="button-secondary">
                <ExternalLink className="size-4" />
                Buka
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Daftar event ${event.name}: ${url}`)}`}
                target="_blank"
                className="button-secondary col-span-2"
              >
                <Share2 className="size-4" />
                Bagikan WhatsApp
              </a>
            </div>
          </>
        ) : (
          <Skeleton className="mt-5 h-52" />
        )}
      </div>
    </div>
  );
}

function TicketTypes({ event_id }: { event_id: string }) {
  const query = useQuery({
    queryKey: ["ticket-types", event_id],
    queryFn: () =>
      api_client<{ ticket_types: any[] }>(`/events/${event_id}/ticket-types`),
  });
  const [open, set_open] = useState(false);
  const [form, set_form] = useState({
    name: "",
    slug: "",
    description: "",
    price: 0,
    currency: "IDR",
    quota: 100,
    min_per_order: 1,
    max_per_order: 10,
    visibility: "public",
    sort_order: 0,
    is_active: true,
  });
  const create = useMutation({
    mutationFn: () =>
      api_client(`/events/${event_id}/ticket-types`, {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success("Jenis tiket dibuat");
      set_open(false);
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api_client(`/events/${event_id}/ticket-types/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Jenis tiket dihapus");
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => set_open((value) => !value)}>
          <Plus className="size-4" />
          Jenis tiket
        </Button>
      </div>
      {open ? (
        <div className="surface mb-5 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Nama">
            <input
              className="input"
              value={form.name}
              onChange={(event) =>
                set_form({ ...form, name: event.target.value })
              }
            />
          </Field>
          <Field label="Slug">
            <input
              className="input"
              value={form.slug}
              onChange={(event) =>
                set_form({ ...form, slug: event.target.value })
              }
            />
          </Field>
          <Field label="Harga">
            <input
              type="number"
              className="input"
              value={form.price}
              onChange={(event) =>
                set_form({ ...form, price: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Kuota">
            <input
              type="number"
              className="input"
              value={form.quota}
              onChange={(event) =>
                set_form({ ...form, quota: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Min per order">
            <input
              type="number"
              className="input"
              value={form.min_per_order}
              onChange={(event) =>
                set_form({ ...form, min_per_order: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Maks per order">
            <input
              type="number"
              className="input"
              value={form.max_per_order}
              onChange={(event) =>
                set_form({ ...form, max_per_order: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Visibilitas">
            <select
              className="input"
              value={form.visibility}
              onChange={(event) =>
                set_form({ ...form, visibility: event.target.value })
              }
            >
              <option value="public">Publik</option>
              <option value="access_code">Kode akses</option>
              <option value="hidden">Tersembunyi</option>
            </select>
          </Field>
          <div className="flex items-end">
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              Simpan
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {query.data?.data.ticket_types.map((ticket) => (
          <article key={ticket.id} className="surface p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold">{ticket.name}</h3>
                <p className="mt-1 text-xs font-mono text-stone-400">
                  /{ticket.slug}
                </p>
              </div>
              <StatusBadge status={ticket.isActive ? "active" : "inactive"} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-stone-50 p-3 text-sm">
              <div>
                <p className="text-xs text-stone-400">Harga</p>
                <p className="font-bold">{format_idr(ticket.price)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Kuota</p>
                <p className="font-bold">{ticket.quota ?? "∞"}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400">Per order</p>
                <p className="font-bold">
                  {ticket.minPerOrder}–{ticket.maxPerOrder}
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                confirm("Hapus jenis tiket ini?") && remove.mutate(ticket.id)
              }
              className="mt-4 flex items-center gap-2 text-xs font-semibold text-red-600"
            >
              <Trash2 className="size-3.5" />
              Hapus
            </button>
          </article>
        ))}
      </div>
      {!query.data?.data.ticket_types.length ? (
        <EmptyState
          title="Belum ada jenis tiket"
          description="Tambahkan minimal satu jenis tiket sebelum event dapat dipublikasikan."
        />
      ) : null}
    </div>
  );
}

function AddOns({ event_id }: { event_id: string }) {
  const query = useQuery({
    queryKey: ["add-ons", event_id],
    queryFn: () =>
      api_client<{ add_ons: any[] }>(`/events/${event_id}/add-ons`),
  });
  const [open, set_open] = useState(false);
  const [options, set_options] = useState("");
  const [form, set_form] = useState({
    name: "",
    slug: "",
    description: "",
    price: 0,
    quota: 100,
    selection_type: "quantity",
    min_quantity: 0,
    max_quantity: 1,
    is_required: false,
    sort_order: 0,
    is_active: true,
  });
  const create = useMutation({
    mutationFn: () =>
      api_client(`/events/${event_id}/add-ons`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          options: options
            ? options.split(",").map((value, index) => ({
                label: value.trim(),
                value: value.trim().toLowerCase().replaceAll(" ", "_"),
                price_adjustment: 0,
                sort_order: index,
              }))
            : undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Add-on dibuat");
      set_open(false);
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => set_open(!open)}>
          <Plus className="size-4" />
          Add-on
        </Button>
      </div>
      {open ? (
        <div className="surface mb-5 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Nama">
            <input
              className="input"
              value={form.name}
              onChange={(e) => set_form({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Slug">
            <input
              className="input"
              value={form.slug}
              onChange={(e) => set_form({ ...form, slug: e.target.value })}
            />
          </Field>
          <Field label="Harga">
            <input
              type="number"
              className="input"
              value={form.price}
              onChange={(e) =>
                set_form({ ...form, price: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Tipe">
            <select
              className="input"
              value={form.selection_type}
              onChange={(e) =>
                set_form({ ...form, selection_type: e.target.value })
              }
            >
              <option value="quantity">Jumlah</option>
              <option value="single_option">Pilihan tunggal</option>
            </select>
          </Field>
          <div className="sm:col-span-2 xl:col-span-3">
            <Field label="Opsi (pisahkan koma)" hint="Contoh: S, M, L, XL, XXL">
              <input
                className="input"
                value={options}
                onChange={(e) => set_options(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-end">
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              Simpan
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {query.data?.data.add_ons.map((item) => (
          <article key={item.id} className="surface p-5">
            <div className="flex justify-between">
              <div>
                <h3 className="font-bold">{item.name}</h3>
                <p className="text-xs text-stone-400">
                  {item.description ?? "Add-on event"}
                </p>
              </div>
              <StatusBadge status={item.isActive ? "active" : "inactive"} />
            </div>
            <p className="mt-5 text-2xl font-bold">{format_idr(item.price)}</p>
            {item.options.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.options.map((option: any) => (
                  <span
                    key={option.id}
                    className="badge border-stone-200 bg-stone-50"
                  >
                    {option.label}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {!query.data?.data.add_ons.length ? (
        <EmptyState
          title="Belum ada add-on"
          description="Add-on bersifat opsional. Tambahkan merchandise, konsumsi, atau kebutuhan lainnya."
        />
      ) : null}
    </div>
  );
}

function FormBuilder({ event_id }: { event_id: string }) {
  const query = useQuery({
    queryKey: ["form-fields", event_id],
    queryFn: () =>
      api_client<{ form_fields: any[] }>(`/events/${event_id}/form-fields`),
  });
  const [open, set_open] = useState(false);
  const [form, set_form] = useState({
    field_key: "",
    label: "",
    field_type: "text",
    placeholder: "",
    help_text: "",
    sort_order: 10,
    is_required: false,
    is_active: true,
  });
  const create = useMutation({
    mutationFn: () =>
      api_client(`/events/${event_id}/form-fields`, {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      toast.success("Field ditambahkan");
      set_open(false);
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api_client(`/events/${event_id}/form-fields/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Field dihapus");
      void query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const move = useMutation({
    mutationFn: (fields: any[]) =>
      api_client(`/events/${event_id}/form-fields/reorder`, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      }),
    onSuccess: () => void query.refetch(),
  });
  const fields = query.data?.data.form_fields ?? [];
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => set_open(!open)}>
          <Plus className="size-4" />
          Field
        </Button>
      </div>
      {open ? (
        <div className="surface mb-5 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Field key">
            <input
              className="input font-mono"
              value={form.field_key}
              onChange={(e) => set_form({ ...form, field_key: e.target.value })}
            />
          </Field>
          <Field label="Label">
            <input
              className="input"
              value={form.label}
              onChange={(e) => set_form({ ...form, label: e.target.value })}
            />
          </Field>
          <Field label="Tipe">
            <select
              className="input"
              value={form.field_type}
              onChange={(e) =>
                set_form({ ...form, field_type: e.target.value })
              }
            >
              {[
                "text",
                "textarea",
                "number",
                "email",
                "phone",
                "date",
                "select",
                "radio",
                "checkbox",
                "file",
              ].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              Tambahkan
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_.72fr]">
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="surface flex items-center gap-4 p-4">
              <button
                disabled={index === 0}
                onClick={() => {
                  const reordered = fields.map((entry: any, i: number) => ({
                    id: entry.id,
                    sort_order:
                      i === index ? index - 1 : i === index - 1 ? index : i,
                  }));
                  move.mutate(reordered);
                }}
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-50"
              >
                <ArrowUp className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold">{field.label}</p>
                  {field.isSystem ? (
                    <span className="badge border-moss-100 bg-moss-50 text-moss-700">
                      sistem
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-xs text-stone-400">
                  {field.fieldKey} · {field.fieldType}
                  {field.isRequired ? " · required" : ""}
                </p>
              </div>
              {!field.isSystem ? (
                <button
                  onClick={() =>
                    confirm("Hapus field ini?") && remove.mutate(field.id)
                  }
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="surface h-fit p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-moss-600">
            Preview mobile
          </p>
          <div className="mx-auto mt-5 max-w-sm rounded-[2rem] border-8 border-ink bg-paper p-5 shadow-xl">
            <p className="text-lg font-bold">Data peserta</p>
            <div className="mt-5 space-y-4">
              {fields
                .filter((field) => field.isActive)
                .map((field) => (
                  <Field
                    key={field.id}
                    label={`${field.label}${field.isRequired ? " *" : ""}`}
                  >
                    <input
                      disabled
                      className="input bg-white"
                      placeholder={field.placeholder ?? ""}
                    />
                  </Field>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type RegistrationRow = {
  id: string;
  fullName: string;
  email: string;
  registrationCode: string;
  totalAmount: string;
  status: string;
  payments: Array<{
    id: string;
    provider: string;
    paymentMethod: string;
    status: string;
  }>;
  _count: { tickets: number };
};

function Registrations({ event_id }: { event_id: string }) {
  const [search, set_search] = useState("");
  const [date_from, set_date_from] = useState("");
  const [date_to, set_date_to] = useState("");
  const [downloading, set_downloading] = useState(false);
  const [selected, set_selected] = useState<RegistrationRow | null>(null);
  const [method, set_method] = useState("cash");
  const [reference, set_reference] = useState("");
  const [notes, set_notes] = useState("");
  const [confirmed, set_confirmed] = useState(false);
  const query = useQuery({
    queryKey: ["registrations", event_id, search, date_from, date_to],
    queryFn: () => {
      const params = event_report_params(date_from, date_to);
      if (search) params.set("search", search);
      return api_client<{ registrations: RegistrationRow[] }>(
        `/events/${event_id}/registrations?${params.toString()}`,
      );
    },
  });
  const settlement = useMutation({
    mutationFn: () =>
      api_client(
        `/events/${event_id}/registrations/${selected?.id}/manual-settlement`,
        {
          method: "POST",
          body: JSON.stringify({
            payment_method: method,
            reference_number: reference || undefined,
            notes: notes || undefined,
          }),
        },
      ),
    onSuccess: async () => {
      toast.success("Settlement OTS berhasil, tiket sudah diterbitkan");
      set_selected(null);
      set_confirmed(false);
      set_reference("");
      set_notes("");
      await query.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function open_settlement(item: RegistrationRow) {
    set_selected(item);
    set_method("cash");
    set_reference("");
    set_notes("");
    set_confirmed(false);
  }

  async function download() {
    set_downloading(true);
    try {
      await download_event_report(event_id, date_from, date_to);
      toast.success("Laporan Excel berhasil diunduh");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Download laporan gagal",
      );
    } finally {
      set_downloading(false);
    }
  }

  return (
    <div>
      <div className="surface mb-4 space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-stone-50 px-3">
            <Banknote className="size-4 shrink-0 text-moss-600" />
            <input
              className="w-full border-0 bg-transparent text-sm focus:ring-0"
              placeholder="Cari nama, email, atau kode registrasi..."
              value={search}
              onChange={(e) => set_search(e.target.value)}
            />
          </div>
          <Button loading={downloading} onClick={() => void download()}>
            <Download className="size-4" />
            Download Excel
          </Button>
        </div>
        <DateRangeFilter
          date_from={date_from}
          date_to={date_to}
          on_from={set_date_from}
          on_to={set_date_to}
          on_reset={() => {
            set_date_from("");
            set_date_to("");
          }}
        />
      </div>
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-5 py-3">Peserta</th>
                <th className="px-5 py-3">Kode</th>
                <th className="px-5 py-3">Pembayaran</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {query.data?.data.registrations.map((item) => {
                const payment = item.payments[0];
                const can_settle =
                  Number(item.totalAmount) > 0 &&
                  ["pending", "pending_payment", "expired"].includes(
                    item.status,
                  );
                return (
                  <tr key={item.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold">{item.fullName}</p>
                      <p className="text-xs text-stone-400">
                        {mask_email(item.email)}
                      </p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {item.registrationCode}
                    </td>
                    <td className="px-5 py-4">
                      {payment ? (
                        <div>
                          <p className="text-xs font-black">
                            {payment.provider === "manual"
                              ? payment.paymentMethod.replaceAll("_", " ")
                              : "Xendit QRIS"}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-stone-400">
                            {payment.status}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400">
                          Belum ada
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {format_idr(item.totalAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      {can_settle ? (
                        <Button
                          variant="secondary"
                          className="min-h-9 rounded-xl px-3 py-1.5 text-xs"
                          onClick={() => open_settlement(item)}
                        >
                          <Banknote className="size-4" />
                          Settlement OTS
                        </Button>
                      ) : item.status === "confirmed" ? (
                        <span className="text-xs font-bold text-emerald-600">
                          {item._count.tickets} tiket terbit
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-ink/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settlement-title"
        >
          <div className="surface w-full max-w-lg overflow-hidden">
            <div className="flex items-start justify-between bg-ink p-6 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-400">
                  On the spot payment
                </p>
                <h2
                  id="settlement-title"
                  className="mt-2 text-2xl font-black tracking-tight"
                >
                  Settlement manual OTS
                </h2>
                <p className="mt-1 text-xs text-white/45">
                  {selected.fullName} · {selected.registrationCode}
                </p>
              </div>
              <button
                className="rounded-xl bg-white/10 p-2"
                onClick={() => set_selected(null)}
                aria-label="Tutup"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="flex items-center justify-between rounded-2xl bg-moss-50 p-4">
                <span className="text-sm font-bold">Nominal diterima</span>
                <span className="text-xl font-black text-moss-700">
                  {format_idr(selected.totalAmount)}
                </span>
              </div>
              <Field label="Metode pembayaran">
                <select
                  className="input"
                  value={method}
                  onChange={(event) => set_method(event.target.value)}
                >
                  <option value="cash">Tunai / Cash</option>
                  <option value="edc">EDC di lokasi</option>
                  <option value="bank_transfer">Transfer bank</option>
                  <option value="other">Lainnya</option>
                </select>
              </Field>
              <Field
                label="Nomor referensi"
                hint="Opsional untuk cash, disarankan untuk EDC atau transfer."
              >
                <input
                  className="input"
                  value={reference}
                  onChange={(event) => set_reference(event.target.value)}
                  placeholder="Nomor struk / referensi"
                />
              </Field>
              <Field label="Catatan internal">
                <textarea
                  className="input min-h-24"
                  value={notes}
                  onChange={(event) => set_notes(event.target.value)}
                  placeholder="Contoh: diterima oleh kasir booth utama"
                />
              </Field>
              <label className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium leading-5 text-amber-950">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-amber-300 text-moss-600 focus:ring-moss-500"
                  checked={confirmed}
                  onChange={(event) => set_confirmed(event.target.checked)}
                />
                <span>
                  Saya memastikan dana sudah diterima. QRIS Xendit aktif akan
                  dibatalkan dan tiket langsung diterbitkan.
                </span>
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => set_selected(null)}>
                  Batal
                </Button>
                <Button
                  disabled={!confirmed}
                  loading={settlement.isPending}
                  onClick={() => settlement.mutate()}
                >
                  <Banknote className="size-4" />
                  Konfirmasi settlement
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type FinancialReport = {
  period: { from: string | null; to: string | null };
  registrations: {
    total: number;
    statuses: Record<string, number>;
    ticket_value: number;
    add_on_value: number;
    billed_value: number;
  };
  tickets: { issued: number; checked_in: number };
  revenue: {
    gross: number;
    xendit: number;
    ots: number;
    successful_transactions: number;
  };
  payments: {
    total: number;
    statuses: Record<string, number>;
    failed: number;
    pending: number;
    replaced_by_ots: number;
    success_rate: number;
    methods: Array<{
      provider: string;
      method: string;
      count: number;
      revenue: number;
    }>;
  };
  ticket_breakdown: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  add_on_breakdown: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  daily_revenue: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
  recent_payments: Array<{
    id: string;
    registration_code: string;
    full_name: string;
    email: string;
    provider: string;
    method: string;
    status: string;
    failure_code: string | null;
    amount: number;
    currency: string;
    activity_at: string;
    manual_reference: string | null;
  }>;
};

function EventReports({ event_id }: { event_id: string }) {
  const [date_from, set_date_from] = useState("");
  const [date_to, set_date_to] = useState("");
  const [downloading, set_downloading] = useState(false);
  const query = useQuery({
    queryKey: ["event-financial-report", event_id, date_from, date_to],
    queryFn: () => {
      const params = event_report_params(date_from, date_to);
      return api_client<FinancialReport>(
        `/events/${event_id}/reports/summary?${params.toString()}`,
      );
    },
  });

  async function download() {
    set_downloading(true);
    try {
      await download_event_report(event_id, date_from, date_to);
      toast.success("Laporan Excel lengkap berhasil diunduh");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Download laporan gagal",
      );
    } finally {
      set_downloading(false);
    }
  }

  if (query.isLoading) return <Skeleton className="h-[42rem]" />;
  if (!query.data) {
    return (
      <EmptyState
        title="Laporan belum tersedia"
        description={
          query.error instanceof Error
            ? query.error.message
            : "Data laporan event tidak dapat dimuat."
        }
      />
    );
  }
  const report = query.data.data;
  const registration_statuses = Object.entries(report.registrations.statuses);
  const payment_statuses = Object.entries(report.payments.statuses);

  return (
    <div className="space-y-5">
      <div className="surface p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-moss-600">
              <TrendingUp className="size-5" />
              <p className="text-xs font-black uppercase tracking-[.16em]">
                Event intelligence
              </p>
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Pemasukan & performa pembayaran
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Pemasukan dihitung dari pembayaran sukses. Nilai tiket dan add-on
              menunjukkan komposisi pesanan terdaftar pada periode pilihan.
            </p>
          </div>
          <Button loading={downloading} onClick={() => void download()}>
            <Download className="size-4" />
            Download Excel lengkap
          </Button>
        </div>
        <div className="mt-5 border-t border-stone-100 pt-5">
          <DateRangeFilter
            date_from={date_from}
            date_to={date_to}
            on_from={set_date_from}
            on_to={set_date_to}
            on_reset={() => {
              set_date_from("");
              set_date_to("");
            }}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Pemasukan sukses",
            value: format_idr(report.revenue.gross),
            detail: `${report.revenue.successful_transactions} transaksi`,
            icon: CircleDollarSign,
            color: "bg-emerald-100 text-emerald-700",
          },
          {
            label: "Xendit",
            value: format_idr(report.revenue.xendit),
            detail: "Pembayaran online sukses",
            icon: CreditCard,
            color: "bg-sky-100 text-sky-700",
          },
          {
            label: "Settlement OTS",
            value: format_idr(report.revenue.ots),
            detail: `${report.payments.replaced_by_ots} QRIS diganti OTS`,
            icon: Banknote,
            color: "bg-amber-100 text-amber-700",
          },
          {
            label: "Success rate",
            value: `${(report.payments.success_rate * 100).toFixed(1)}%`,
            detail: `${report.payments.failed} gagal · ${report.payments.pending} pending`,
            icon: TrendingUp,
            color: "bg-moss-100 text-moss-700",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="surface p-5">
              <div
                className={`grid size-10 place-items-center rounded-xl ${item.color}`}
              >
                <Icon className="size-5" />
              </div>
              <p className="mt-5 text-xs font-bold text-stone-400">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight">
                {item.value}
              </p>
              <p className="mt-2 text-xs text-stone-500">{item.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="surface overflow-hidden">
          <div className="border-b border-stone-100 p-5">
            <h3 className="font-black">Status transaksi</h3>
            <p className="mt-1 text-xs text-stone-500">
              Semua percobaan pembayaran dalam periode aktivitas.
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {payment_statuses.length ? (
              payment_statuses.map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-2xl border border-stone-100 p-4"
                >
                  <StatusBadge status={status} />
                  <span className="text-xl font-black">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-stone-400">Belum ada pembayaran.</p>
            )}
          </div>
        </div>

        <div className="surface overflow-hidden">
          <div className="border-b border-stone-100 p-5">
            <h3 className="font-black">Pendaftar & kehadiran</h3>
            <p className="mt-1 text-xs text-stone-500">
              Berdasarkan waktu pendaftaran pada rentang terpilih.
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Metric
              label="Total pendaftar"
              value={report.registrations.total}
            />
            <Metric label="Tiket terbit" value={report.tickets.issued} />
            <Metric label="Sudah check-in" value={report.tickets.checked_in} />
            <Metric
              label="Nilai tagihan"
              value={format_idr(report.registrations.billed_value)}
            />
            {registration_statuses.map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between rounded-2xl bg-stone-50 p-4"
              >
                <StatusBadge status={status} />
                <span className="font-black">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <BreakdownCard
          title="Komposisi tiket"
          subtitle={`Nilai tiket ${format_idr(report.registrations.ticket_value)}`}
          items={report.ticket_breakdown}
          empty="Belum ada tiket terkonfirmasi."
        />
        <BreakdownCard
          title="Komposisi add-on"
          subtitle={`Nilai add-on ${format_idr(report.registrations.add_on_value)}`}
          items={report.add_on_breakdown}
          empty="Belum ada add-on terkonfirmasi."
        />
      </div>

      <div className="surface overflow-hidden">
        <div className="border-b border-stone-100 p-5">
          <h3 className="font-black">Metode pembayaran</h3>
          <p className="mt-1 text-xs text-stone-500">
            Nominal hanya menjumlahkan transaksi berstatus sukses.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-5 py-3">Provider</th>
                <th className="px-5 py-3">Metode</th>
                <th className="px-5 py-3 text-right">Transaksi</th>
                <th className="px-5 py-3 text-right">Pemasukan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {report.payments.methods.map((item) => (
                <tr key={`${item.provider}:${item.method}`}>
                  <td className="px-5 py-4 font-bold capitalize">
                    {item.provider}
                  </td>
                  <td className="px-5 py-4">{humanize_status(item.method)}</td>
                  <td className="px-5 py-4 text-right font-bold">
                    {item.count}
                  </td>
                  <td className="px-5 py-4 text-right font-black text-moss-700">
                    {format_idr(item.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
        <div className="surface overflow-hidden">
          <div className="border-b border-stone-100 p-5">
            <h3 className="font-black">Pemasukan harian</h3>
          </div>
          <div className="max-h-[28rem] divide-y divide-stone-100 overflow-y-auto">
            {report.daily_revenue.length ? (
              report.daily_revenue.map((item) => (
                <div
                  key={item.date}
                  className="flex items-center justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <p className="font-bold">{item.date}</p>
                    <p className="text-xs text-stone-400">
                      {item.transactions} transaksi
                    </p>
                  </div>
                  <p className="font-black text-moss-700">
                    {format_idr(item.revenue)}
                  </p>
                </div>
              ))
            ) : (
              <p className="p-5 text-sm text-stone-400">
                Belum ada pemasukan sukses.
              </p>
            )}
          </div>
        </div>

        <div className="surface overflow-hidden">
          <div className="border-b border-stone-100 p-5">
            <h3 className="font-black">Aktivitas pembayaran terbaru</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-5 py-3">Pendaftar</th>
                  <th className="px-5 py-3">Pembayaran</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {report.recent_payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold">{payment.full_name}</p>
                      <p className="mt-1 font-mono text-[10px] text-stone-400">
                        {payment.registration_code}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold capitalize">{payment.provider}</p>
                      <p className="text-xs text-stone-400">
                        {humanize_status(payment.method)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={payment.status} />
                      {payment.failure_code ? (
                        <p className="mt-1 max-w-44 truncate text-[10px] text-red-500">
                          {humanize_status(payment.failure_code)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="font-black">{format_idr(payment.amount)}</p>
                      <p className="mt-1 text-[10px] text-stone-400">
                        {format_date(payment.activity_at)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-moss-50 p-4">
      <p className="text-xs font-bold text-moss-600">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  items,
  empty,
}: {
  title: string;
  subtitle: string;
  items: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  empty: string;
}) {
  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-stone-100 p-5">
        <h3 className="font-black">{title}</h3>
        <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
      </div>
      <div className="divide-y divide-stone-100">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-bold">{item.name}</p>
                <p className="mt-1 text-xs text-stone-400">
                  {item.quantity} item
                </p>
              </div>
              <p className="shrink-0 font-black text-moss-700">
                {format_idr(item.revenue)}
              </p>
            </div>
          ))
        ) : (
          <p className="p-5 text-sm text-stone-400">{empty}</p>
        )}
      </div>
    </div>
  );
}

function DateRangeFilter({
  date_from,
  date_to,
  on_from,
  on_to,
  on_reset,
}: {
  date_from: string;
  date_to: string;
  on_from: (value: string) => void;
  on_to: (value: string) => void;
  on_reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="flex items-center gap-2 text-xs font-bold text-stone-500 lg:pb-3">
        <CalendarRange className="size-4 text-moss-600" />
        Rentang tanggal & waktu
      </div>
      <Field label="Mulai">
        <input
          type="datetime-local"
          className="input min-w-56"
          value={date_from}
          max={date_to || undefined}
          onChange={(event) => on_from(event.target.value)}
        />
      </Field>
      <Field label="Sampai">
        <input
          type="datetime-local"
          className="input min-w-56"
          value={date_to}
          min={date_from || undefined}
          onChange={(event) => on_to(event.target.value)}
        />
      </Field>
      {(date_from || date_to) && (
        <Button variant="secondary" onClick={on_reset}>
          <RefreshCcw className="size-4" />
          Reset
        </Button>
      )}
    </div>
  );
}

function event_report_params(date_from: string, date_to: string) {
  const params = new URLSearchParams();
  if (date_from) params.set("date_from", new Date(date_from).toISOString());
  if (date_to) {
    const inclusive_end = new Date(date_to);
    if (date_to.length === 16) inclusive_end.setSeconds(59, 999);
    params.set("date_to", inclusive_end.toISOString());
  }
  return params;
}

async function download_event_report(
  event_id: string,
  date_from: string,
  date_to: string,
) {
  const params = event_report_params(date_from, date_to);
  const response = await fetch(
    `/api/v1/events/${event_id}/reports/export?${params.toString()}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Download laporan Excel gagal");
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded_name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const filename = encoded_name
    ? decodeURIComponent(encoded_name)
    : "laporan-event.xlsx";
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function humanize_status(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function CheckIn({ event_id }: { event_id: string }) {
  const [token, set_token] = useState("");
  const [result, set_result] = useState<any>(null);
  const validate = useMutation({
    mutationFn: () =>
      api_client<any>(`/events/${event_id}/check-ins/validate`, {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    onSuccess: (response) => set_result(response.data),
    onError: (error: Error) => {
      set_result(null);
      toast.error(error.message);
    },
  });
  const checkin = useMutation({
    mutationFn: () =>
      api_client<any>(`/events/${event_id}/check-ins`, {
        method: "POST",
        body: JSON.stringify({
          token,
          sync_key: crypto.randomUUID(),
          source: "web",
        }),
      }),
    onSuccess: (response) => {
      set_result((current: any) => ({
        ...current,
        ...response.data,
        valid: false,
        ticket: { ...current?.ticket, ...response.data.ticket },
      }));
      toast.success("Check-in berhasil");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_.72fr]">
      <div className="surface p-6">
        <QrCode className="size-6 text-moss-600" />
        <h2 className="mt-5 text-xl font-bold">Validasi tiket</h2>
        <p className="mt-1 text-sm text-stone-500">
          Scan QR tiket atau masukkan token, kode TKT, maupun kode REG untuk
          pendaftaran satu tiket.
        </p>
        <textarea
          className="input mt-6 min-h-32 font-mono text-xs"
          value={token}
          onChange={(e) => set_token(e.target.value)}
          placeholder="Token QR, TKT-..., atau REG-..."
        />
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            loading={validate.isPending}
            onClick={() => validate.mutate()}
          >
            Validasi
          </Button>
          <Button
            loading={checkin.isPending}
            disabled={!result?.valid}
            onClick={() => checkin.mutate()}
          >
            <Check className="size-4" />
            Konfirmasi check-in
          </Button>
        </div>
      </div>
      <div
        className={`surface p-6 ${result?.valid ? "border-emerald-200 bg-emerald-50/40" : ""}`}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Hasil scanner
        </p>
        {result ? (
          <div className="mt-8 text-center">
            <div
              className={`mx-auto grid size-16 place-items-center rounded-full ${result.valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
            >
              {result.valid ? (
                <Check className="size-7" />
              ) : (
                <QrCode className="size-7" />
              )}
            </div>
            <h3 className="mt-4 text-xl font-bold">
              {result.ticket?.holder_name ?? "Check-in diproses"}
            </h3>
            <p className="mt-1 font-mono text-xs text-stone-500">
              {result.ticket?.ticket_code}
            </p>
            <div className="mt-4">
              <StatusBadge
                status={
                  result.ticket?.status ??
                  (result.check_in ? "checked_in" : "invalid")
                }
              />
            </div>
            <div className="mt-6 space-y-3 text-left">
              {result.ticket_type && (
                <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    Jenis tiket
                  </p>
                  <div className="mt-2 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-ink-950">
                        {result.ticket_type.name}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {result.ticket_type.quantity} tiket ·{" "}
                        {format_idr(result.ticket_type.unit_price)} / tiket
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-moss-700">
                      {format_idr(result.ticket_type.total_price)}
                    </p>
                  </div>
                </div>
              )}

              {result.registration && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                      Registrasi
                    </p>
                    <p className="mt-2 font-mono text-xs font-bold text-ink-950">
                      {result.registration.registration_code}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {result.registration.whatsapp_number}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                      Pembayaran
                    </p>
                    {result.payment ? (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <StatusBadge status={result.payment.status} />
                          <span className="text-xs font-semibold text-stone-600">
                            {result.payment.provider.toUpperCase()} ·{" "}
                            {result.payment.method}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-ink-950">
                          {format_idr(result.registration.total_amount)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-stone-500">
                        Belum ada pembayaran
                      </p>
                    )}
                  </div>
                </div>
              )}

              {Array.isArray(result.add_ons) && (
                <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                    Add-on
                  </p>
                  {result.add_ons.length ? (
                    <div className="mt-2 divide-y divide-stone-100">
                      {result.add_ons.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
                        >
                          <div>
                            <p className="text-sm font-bold text-ink-950">
                              {item.name}
                              {item.option ? ` · ${item.option}` : ""}
                            </p>
                            <p className="text-xs text-stone-500">
                              {item.quantity} × {format_idr(item.unit_price)}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-moss-700">
                            {format_idr(item.total_price)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-stone-500">
                      Tidak mengambil add-on
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            title="Belum ada pemindaian"
            description="Hasil validasi tiket akan tampil di sini."
          />
        )}
      </div>
    </div>
  );
}
