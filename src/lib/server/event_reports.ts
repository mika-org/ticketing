import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { ApiError } from "./api";
import { prisma } from "./prisma";

export type EventReportRange = {
  from?: Date;
  to?: Date;
};

export function parse_event_report_range(request: Request): EventReportRange {
  const url = new URL(request.url);
  const from = parse_date_param(url.searchParams.get("date_from"), "date_from");
  const to = parse_date_param(url.searchParams.get("date_to"), "date_to");
  if (from && to && from > to) {
    throw new ApiError(
      422,
      "invalid_date_range",
      "Tanggal mulai tidak boleh melewati tanggal akhir",
    );
  }
  return { from, to };
}

export async function get_event_financial_report(
  tenant_id: string,
  event_id: string,
  range: EventReportRange,
) {
  const registration_where = registration_where_for_range(
    tenant_id,
    event_id,
    range,
  );
  const payment_where = payment_where_for_range(tenant_id, event_id, range);
  const [
    event,
    registration_groups,
    registration_totals,
    payments,
    ticket_count,
    checked_in_count,
    ticket_groups,
    add_on_groups,
  ] = await Promise.all([
    prisma.event.findFirst({
      where: { id: event_id, tenantId: tenant_id, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        startAt: true,
        endAt: true,
        tenant: { select: { name: true } },
      },
    }),
    prisma.registration.groupBy({
      by: ["status"],
      where: registration_where,
      _count: true,
    }),
    prisma.registration.aggregate({
      where: registration_where,
      _count: true,
      _sum: {
        subtotalAmount: true,
        addOnAmount: true,
        totalAmount: true,
      },
    }),
    prisma.payment.findMany({
      where: payment_where,
      select: {
        id: true,
        provider: true,
        paymentMethod: true,
        status: true,
        failureCode: true,
        amount: true,
        currency: true,
        paidAt: true,
        createdAt: true,
        manualReference: true,
        registration: {
          select: {
            registrationCode: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ticket.count({
      where: {
        tenantId: tenant_id,
        eventId: event_id,
        registration: registration_date_filter(range),
      },
    }),
    prisma.checkIn.count({
      where: {
        tenantId: tenant_id,
        eventId: event_id,
        voidedAt: null,
        ticket: { registration: registration_date_filter(range) },
      },
    }),
    prisma.registrationItem.groupBy({
      by: ["ticketTypeId"],
      where: {
        tenantId: tenant_id,
        registration: {
          eventId: event_id,
          status: "confirmed",
          ...registration_date_filter(range),
        },
      },
      _sum: { quantity: true, totalPrice: true },
    }),
    prisma.registrationAddOn.groupBy({
      by: ["addOnId"],
      where: {
        tenantId: tenant_id,
        registration: {
          eventId: event_id,
          status: "confirmed",
          ...registration_date_filter(range),
        },
      },
      _sum: { quantity: true, totalPrice: true },
    }),
  ]);
  if (!event) {
    throw new ApiError(404, "event_not_found", "Event tidak ditemukan");
  }

  const [ticket_types, add_ons] = await Promise.all([
    prisma.ticketType.findMany({
      where: { id: { in: ticket_groups.map((entry) => entry.ticketTypeId) } },
      select: { id: true, name: true },
    }),
    prisma.addOn.findMany({
      where: { id: { in: add_on_groups.map((entry) => entry.addOnId) } },
      select: { id: true, name: true },
    }),
  ]);
  const ticket_names = new Map(
    ticket_types.map((item) => [item.id, item.name]),
  );
  const add_on_names = new Map(add_ons.map((item) => [item.id, item.name]));

  const payment_statuses: Record<string, number> = {};
  const payment_methods = new Map<
    string,
    { provider: string; method: string; count: number; revenue: number }
  >();
  const daily_revenue = new Map<
    string,
    { date: string; revenue: number; transactions: number }
  >();
  let gross_revenue = 0;
  let xendit_revenue = 0;
  let ots_revenue = 0;
  let successful_transactions = 0;
  let replaced_by_ots = 0;

  for (const payment of payments) {
    payment_statuses[payment.status] =
      (payment_statuses[payment.status] ?? 0) + 1;
    if (payment.failureCode === "replaced_by_manual_ots") replaced_by_ots += 1;
    const amount = Number(payment.amount);
    const key = `${payment.provider}:${payment.paymentMethod}`;
    const method = payment_methods.get(key) ?? {
      provider: payment.provider,
      method: payment.paymentMethod,
      count: 0,
      revenue: 0,
    };
    method.count += 1;
    if (payment.status === "succeeded") {
      method.revenue += amount;
      gross_revenue += amount;
      successful_transactions += 1;
      if (payment.provider === "manual") ots_revenue += amount;
      else if (payment.provider === "xendit") xendit_revenue += amount;
      const activity_at = payment.paidAt ?? payment.createdAt;
      const date = activity_at.toISOString().slice(0, 10);
      const daily = daily_revenue.get(date) ?? {
        date,
        revenue: 0,
        transactions: 0,
      };
      daily.revenue += amount;
      daily.transactions += 1;
      daily_revenue.set(date, daily);
    }
    payment_methods.set(key, method);
  }

  const registration_statuses = Object.fromEntries(
    registration_groups.map((entry) => [entry.status, entry._count]),
  );
  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      timezone: event.timezone,
      start_at: event.startAt,
      end_at: event.endAt,
      tenant_name: event.tenant.name,
    },
    period: { from: range.from ?? null, to: range.to ?? null },
    registrations: {
      total: registration_totals._count,
      statuses: registration_statuses,
      ticket_value: Number(registration_totals._sum.subtotalAmount ?? 0),
      add_on_value: Number(registration_totals._sum.addOnAmount ?? 0),
      billed_value: Number(registration_totals._sum.totalAmount ?? 0),
    },
    tickets: { issued: ticket_count, checked_in: checked_in_count },
    revenue: {
      gross: gross_revenue,
      xendit: xendit_revenue,
      ots: ots_revenue,
      successful_transactions,
    },
    payments: {
      total: payments.length,
      statuses: payment_statuses,
      failed: (payment_statuses.failed ?? 0) + (payment_statuses.expired ?? 0),
      pending:
        (payment_statuses.pending ?? 0) +
        (payment_statuses.requires_action ?? 0),
      replaced_by_ots,
      success_rate: payments.length
        ? successful_transactions / payments.length
        : 0,
      methods: [...payment_methods.values()].sort(
        (left, right) => right.revenue - left.revenue,
      ),
    },
    ticket_breakdown: ticket_groups
      .map((entry) => ({
        id: entry.ticketTypeId,
        name: ticket_names.get(entry.ticketTypeId) ?? "Jenis tiket dihapus",
        quantity: entry._sum.quantity ?? 0,
        revenue: Number(entry._sum.totalPrice ?? 0),
      }))
      .sort((left, right) => right.revenue - left.revenue),
    add_on_breakdown: add_on_groups
      .map((entry) => ({
        id: entry.addOnId,
        name: add_on_names.get(entry.addOnId) ?? "Add-on dihapus",
        quantity: entry._sum.quantity ?? 0,
        revenue: Number(entry._sum.totalPrice ?? 0),
      }))
      .sort((left, right) => right.revenue - left.revenue),
    daily_revenue: [...daily_revenue.values()].sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
    recent_payments: payments.slice(0, 12).map((payment) => ({
      id: payment.id,
      registration_code: payment.registration.registrationCode,
      full_name: payment.registration.fullName,
      email: payment.registration.email,
      provider: payment.provider,
      method: payment.paymentMethod,
      status: payment.status,
      failure_code: payment.failureCode,
      amount: Number(payment.amount),
      currency: payment.currency,
      activity_at:
        payment.status === "succeeded"
          ? (payment.paidAt ?? payment.createdAt)
          : payment.createdAt,
      manual_reference: payment.manualReference,
    })),
  };
}

export async function build_event_report_workbook(
  tenant_id: string,
  event_id: string,
  range: EventReportRange,
) {
  const summary = await get_event_financial_report(tenant_id, event_id, range);
  const registration_where = registration_where_for_range(
    tenant_id,
    event_id,
    range,
  );
  const [registrations, payments] = await Promise.all([
    prisma.registration.findMany({
      where: registration_where,
      include: {
        items: {
          include: { ticketType: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
        addOns: {
          include: {
            addOn: { select: { name: true } },
            addOnOption: { select: { label: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        answers: {
          include: { formField: { select: { label: true } } },
          orderBy: { createdAt: "asc" },
        },
        tickets: {
          include: {
            registrationItem: {
              include: { ticketType: { select: { name: true } } },
            },
            checkIns: {
              where: { voidedAt: null },
              orderBy: { checkedInAt: "desc" },
              take: 1,
            },
          },
          orderBy: { createdAt: "asc" },
        },
        payments: {
          include: {
            settledBy: { select: { fullName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { registeredAt: "asc" },
      take: 50_000,
    }),
    prisma.payment.findMany({
      where: payment_where_for_range(tenant_id, event_id, range),
      include: {
        registration: {
          select: {
            registrationCode: true,
            fullName: true,
            email: true,
          },
        },
        settledBy: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100_000,
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ticketing Next";
  workbook.company = summary.event.tenant_name;
  workbook.subject = `Rekap event ${summary.event.name}`;
  workbook.title = `Laporan ${summary.event.name}`;
  workbook.created = new Date();
  workbook.modified = new Date();

  const ringkasan = workbook.addWorksheet("Ringkasan", worksheet_options());
  const pendaftar = workbook.addWorksheet("Pendaftar", worksheet_options());
  const pembayaran = workbook.addWorksheet("Pembayaran", worksheet_options());
  const tiket = workbook.addWorksheet("Detail Tiket", worksheet_options());
  const add_on = workbook.addWorksheet("Detail Add-on", worksheet_options());
  const jawaban = workbook.addWorksheet("Jawaban Form", worksheet_options());

  build_registrations_sheet(pendaftar, summary, registrations);
  build_payments_sheet(pembayaran, summary, payments);
  build_tickets_sheet(tiket, summary, registrations);
  build_add_ons_sheet(add_on, summary, registrations);
  build_answers_sheet(jawaban, summary, registrations);
  build_summary_sheet(ringkasan, summary, {
    registration_rows: registrations.length,
    payment_rows: payments.length,
  });
  ringkasan.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];

  const data = await workbook.xlsx.writeBuffer();
  const date_suffix = new Date().toISOString().slice(0, 10);
  return {
    buffer: Buffer.from(data),
    filename: `laporan-${safe_filename(summary.event.slug)}-${date_suffix}.xlsx`,
  };
}

function build_summary_sheet(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof get_event_financial_report>>,
  rows: { registration_rows: number; payment_rows: number },
) {
  title_block(sheet, "Laporan Event & Pemasukan", summary);
  sheet.getCell("A5").value = "KPI UTAMA";
  sheet.mergeCells("A5:B5");
  section_header(sheet.getCell("A5"));
  const registration_end = Math.max(6, 5 + rows.registration_rows);
  const payment_end = Math.max(6, 5 + rows.payment_rows);
  const kpis = [
    [
      "Total pemasukan sukses",
      {
        formula: `SUMIFS('Pembayaran'!$J$6:$J$${payment_end},'Pembayaran'!$H$6:$H$${payment_end},"succeeded")`,
        result: summary.revenue.gross,
      },
    ],
    [
      "Pemasukan Xendit",
      {
        formula: `SUMIFS('Pembayaran'!$J$6:$J$${payment_end},'Pembayaran'!$H$6:$H$${payment_end},"succeeded",'Pembayaran'!$F$6:$F$${payment_end},"xendit")`,
        result: summary.revenue.xendit,
      },
    ],
    [
      "Pemasukan OTS",
      {
        formula: `SUMIFS('Pembayaran'!$J$6:$J$${payment_end},'Pembayaran'!$H$6:$H$${payment_end},"succeeded",'Pembayaran'!$F$6:$F$${payment_end},"manual")`,
        result: summary.revenue.ots,
      },
    ],
    [
      "Jumlah pendaftar",
      {
        formula: `COUNTA('Pendaftar'!$B$6:$B$${registration_end})`,
        result: summary.registrations.total,
      },
    ],
    ["Nilai tiket terdaftar", summary.registrations.ticket_value],
    ["Nilai add-on terdaftar", summary.registrations.add_on_value],
    ["Tiket diterbitkan", summary.tickets.issued],
    ["Sudah check-in", summary.tickets.checked_in],
  ];
  kpis.forEach((values, index) => {
    sheet.getRow(6 + index).values = values;
  });
  for_cells(sheet, 6, 13, 1, 1, (cell) => {
    cell.font = { bold: true, color: { argb: "FF425248" } };
  });
  set_number_format(sheet, 6, 8, 2, '"Rp" #,##0;[Red]("Rp" #,##0);-');
  set_number_format(sheet, 9, 9, 2, "#,##0");
  set_number_format(sheet, 10, 11, 2, '"Rp" #,##0;[Red]("Rp" #,##0);-');
  set_number_format(sheet, 12, 13, 2, "#,##0");

  sheet.getCell("D5").value = "STATUS PEMBAYARAN";
  sheet.mergeCells("D5:E5");
  sheet.getCell("D5").style = sheet.getCell("A5").style;
  const statuses = Object.entries(summary.payments.statuses);
  sheet.getCell("D6").value = "Status";
  sheet.getCell("E6").value = "Jumlah";
  table_header(sheet, 6, 4, 5);
  statuses.forEach(([status, count], index) => {
    sheet.getCell(7 + index, 4).value = status_label(status);
    sheet.getCell(7 + index, 5).value = count;
  });
  const status_end = Math.max(7, 6 + statuses.length);
  set_number_format(sheet, 7, status_end, 5, "#,##0");

  const method_start = Math.max(16, status_end + 3);
  sheet.getCell(`A${method_start}`).value = "METODE PEMBAYARAN";
  sheet.mergeCells(`A${method_start}:D${method_start}`);
  section_header(sheet.getCell(`A${method_start}`));
  sheet.getRow(method_start + 1).values = [
    "Provider",
    "Metode",
    "Transaksi",
    "Pemasukan sukses",
  ];
  table_header(sheet, method_start + 1, 1, 4);
  summary.payments.methods.forEach((item, index) => {
    sheet.getRow(method_start + 2 + index).values = [
      item.provider,
      item.method.replaceAll("_", " "),
      item.count,
      item.revenue,
    ];
  });
  const method_end = Math.max(
    method_start + 2,
    method_start + 1 + summary.payments.methods.length,
  );
  set_number_format(sheet, method_start + 2, method_end, 3, "#,##0");
  set_number_format(
    sheet,
    method_start + 2,
    method_end,
    4,
    '"Rp" #,##0;[Red]("Rp" #,##0);-',
  );

  const breakdown_start = method_end + 3;
  sheet.getCell(`A${breakdown_start}`).value = "KOMPOSISI TIKET";
  sheet.mergeCells(`A${breakdown_start}:C${breakdown_start}`);
  sheet.getCell(`E${breakdown_start}`).value = "KOMPOSISI ADD-ON";
  sheet.mergeCells(`E${breakdown_start}:G${breakdown_start}`);
  section_header(sheet.getCell(`A${breakdown_start}`));
  section_header(sheet.getCell(`E${breakdown_start}`));
  sheet.getRow(breakdown_start + 1).values = [
    "Jenis tiket",
    "Qty",
    "Nilai",
    null,
    "Add-on",
    "Qty",
    "Nilai",
  ];
  table_header(sheet, breakdown_start + 1, 1, 3);
  table_header(sheet, breakdown_start + 1, 5, 7);
  const breakdown_rows = Math.max(
    summary.ticket_breakdown.length,
    summary.add_on_breakdown.length,
  );
  for (let index = 0; index < breakdown_rows; index += 1) {
    const ticket = summary.ticket_breakdown[index];
    const addon = summary.add_on_breakdown[index];
    sheet.getRow(breakdown_start + 2 + index).values = [
      ticket?.name ?? null,
      ticket?.quantity ?? null,
      ticket?.revenue ?? null,
      null,
      addon?.name ?? null,
      addon?.quantity ?? null,
      addon?.revenue ?? null,
    ];
  }
  const breakdown_end = Math.max(
    breakdown_start + 2,
    breakdown_start + 1 + breakdown_rows,
  );
  set_number_format(sheet, breakdown_start + 2, breakdown_end, 2, "#,##0");
  set_number_format(sheet, breakdown_start + 2, breakdown_end, 6, "#,##0");
  set_number_format(
    sheet,
    breakdown_start + 2,
    breakdown_end,
    3,
    '"Rp" #,##0;[Red]("Rp" #,##0);-',
  );
  set_number_format(
    sheet,
    breakdown_start + 2,
    breakdown_end,
    7,
    '"Rp" #,##0;[Red]("Rp" #,##0);-',
  );

  sheet.columns = [
    { width: 28 },
    { width: 18 },
    { width: 17 },
    { width: 20 },
    { width: 28 },
    { width: 15 },
    { width: 18 },
    { width: 4 },
  ];
  for_cells(sheet, 6, 13, 2, 2, (cell) => {
    cell.alignment = { horizontal: "right" };
  });
  for_cells(sheet, 7, status_end, 5, 5, (cell) => {
    cell.alignment = { horizontal: "right" };
  });
  for_cells(sheet, method_start + 2, method_end, 3, 4, (cell) => {
    cell.alignment = { horizontal: "right" };
  });
  for_cells(sheet, breakdown_start + 2, breakdown_end, 2, 3, (cell) => {
    cell.alignment = { horizontal: "right" };
  });
  for_cells(sheet, breakdown_start + 2, breakdown_end, 6, 7, (cell) => {
    cell.alignment = { horizontal: "right" };
  });
}

function build_registrations_sheet(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof get_event_financial_report>>,
  registrations: any[],
) {
  title_block(sheet, "Rekap Pendaftar", summary);
  const headers = [
    "Waktu Daftar",
    "Kode Registrasi",
    "Nama Lengkap",
    "Email",
    "WhatsApp",
    "Status",
    "Sumber",
    "Tiket Diambil",
    "Qty Tiket",
    "Nilai Tiket",
    "Add-on Diambil",
    "Qty Add-on",
    "Nilai Add-on",
    "Total Tagihan",
    "Provider Terakhir",
    "Metode Terakhir",
    "Status Bayar Terakhir",
    "Waktu Bayar",
    "Kode Tiket",
    "Sudah Check-in",
    "Jawaban Form",
  ];
  sheet.getRow(5).values = headers;
  table_header(sheet, 5, 1, headers.length);
  registrations.forEach((registration: any, index) => {
    const latest_payment = registration.payments[0];
    const tickets_description = registration.items
      .map((item: any) => `${item.ticketType.name} x${item.quantity}`)
      .join("; ");
    const add_ons_description = registration.addOns
      .map(
        (item: any) =>
          `${item.addOn.name}${item.addOnOption ? ` (${item.addOnOption.label})` : ""} x${item.quantity}`,
      )
      .join("; ");
    const answers = registration.answers
      .map(
        (answer: any) =>
          `${answer.formField.label}: ${json_cell_value(answer.answerJson)}`,
      )
      .join(" | ");
    const row = sheet.getRow(6 + index);
    row.values = [
      registration.registeredAt,
      registration.registrationCode,
      registration.fullName,
      registration.email,
      excel_text(registration.whatsappNumber),
      registration.status,
      registration.source,
      tickets_description,
      registration.items.reduce(
        (total: number, item: any) => total + item.quantity,
        0,
      ),
      Number(registration.subtotalAmount),
      add_ons_description,
      registration.addOns.reduce(
        (total: number, item: any) => total + item.quantity,
        0,
      ),
      Number(registration.addOnAmount),
      Number(registration.totalAmount),
      latest_payment?.provider ?? null,
      latest_payment?.paymentMethod ?? null,
      latest_payment?.status ?? null,
      latest_payment?.paidAt ?? null,
      registration.tickets.map((ticket: any) => ticket.ticketCode).join("; "),
      registration.tickets.filter((ticket: any) => ticket.checkIns.length > 0)
        .length,
      answers,
    ];
    style_status_cell(row.getCell(6), registration.status);
    style_status_cell(row.getCell(17), latest_payment?.status);
  });
  finish_detail_sheet(sheet, headers.length, registrations.length, {
    date_columns: [1, 18],
    currency_columns: [10, 13, 14],
    number_columns: [9, 12, 20],
    text_columns: [2, 4, 5, 15, 16, 17, 19],
    wrap_columns: [8, 11, 19, 21],
    widths: [
      21, 22, 25, 30, 18, 16, 12, 32, 11, 17, 32, 12, 17, 18, 16, 20, 20, 21,
      28, 15, 45,
    ],
  });
}

function build_payments_sheet(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof get_event_financial_report>>,
  payments: any[],
) {
  title_block(sheet, "Detail Pembayaran", summary);
  const headers = [
    "Dibuat",
    "Dibayar",
    "Kode Registrasi",
    "Nama",
    "Email",
    "Provider",
    "Metode",
    "Status",
    "Kode Kegagalan",
    "Nominal",
    "Mata Uang",
    "Referensi Internal",
    "Payment Request ID",
    "Payment ID",
    "Business ID",
    "Referensi Manual",
    "Catatan Settlement",
    "Diselesaikan Oleh",
  ];
  sheet.getRow(5).values = headers;
  table_header(sheet, 5, 1, headers.length);
  payments.forEach((payment, index) => {
    const row = sheet.getRow(6 + index);
    row.values = [
      payment.createdAt,
      payment.paidAt ?? null,
      payment.registration.registrationCode,
      payment.registration.fullName,
      payment.registration.email,
      payment.provider,
      payment.paymentMethod,
      payment.status,
      payment.failureCode ?? null,
      Number(payment.amount),
      payment.currency,
      payment.referenceId,
      payment.providerPaymentRequestId ?? null,
      payment.providerPaymentId ?? null,
      payment.providerBusinessId ?? null,
      payment.manualReference ?? null,
      payment.settlementNotes ?? null,
      payment.settledBy
        ? `${payment.settledBy.fullName} (${payment.settledBy.email})`
        : null,
    ];
    style_status_cell(row.getCell(8), payment.status);
  });
  finish_detail_sheet(sheet, headers.length, payments.length, {
    date_columns: [1, 2],
    currency_columns: [10],
    text_columns: [3, 5, 9, 11, 12, 13, 14, 15, 16],
    wrap_columns: [9, 12, 13, 14, 16, 17, 18],
    widths: [
      21, 21, 22, 25, 30, 14, 20, 18, 28, 18, 12, 28, 32, 32, 28, 25, 36, 30,
    ],
  });
}

function build_tickets_sheet(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof get_event_financial_report>>,
  registrations: any[],
) {
  title_block(sheet, "Detail Tiket", summary);
  const headers = [
    "Waktu Daftar",
    "Kode Registrasi",
    "Kode Tiket",
    "Jenis Tiket",
    "Nama Pemegang",
    "Email",
    "Status Tiket",
    "Waktu Terbit",
    "Waktu Check-in",
    "Sumber Check-in",
  ];
  sheet.getRow(5).values = headers;
  table_header(sheet, 5, 1, 10);
  let row_number = 6;
  for (const registration of registrations) {
    for (const ticket of registration.tickets) {
      const check_in = ticket.checkIns[0];
      const row = sheet.getRow(row_number);
      row.values = [
        registration.registeredAt,
        registration.registrationCode,
        ticket.ticketCode,
        ticket.registrationItem.ticketType.name,
        ticket.holderName,
        ticket.holderEmail,
        ticket.status,
        ticket.issuedAt,
        check_in?.checkedInAt ?? null,
        check_in?.source ?? null,
      ];
      style_status_cell(row.getCell(7), ticket.status);
      row_number += 1;
    }
  }
  finish_detail_sheet(sheet, headers.length, row_number - 6, {
    date_columns: [1, 8, 9],
    text_columns: [2, 3, 6, 7, 10],
    widths: [21, 22, 27, 25, 25, 30, 18, 21, 21, 20],
  });
}

function build_add_ons_sheet(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof get_event_financial_report>>,
  registrations: any[],
) {
  title_block(sheet, "Detail Add-on", summary);
  const headers = [
    "Waktu Daftar",
    "Kode Registrasi",
    "Nama Pendaftar",
    "Add-on",
    "Opsi",
    "Qty",
    "Harga Satuan",
    "Total",
    "Status Registrasi",
  ];
  sheet.getRow(5).values = headers;
  table_header(sheet, 5, 1, 9);
  let row_number = 6;
  for (const registration of registrations) {
    for (const item of registration.addOns) {
      const row = sheet.getRow(row_number);
      row.values = [
        registration.registeredAt,
        registration.registrationCode,
        registration.fullName,
        item.addOn.name,
        item.addOnOption?.label ?? null,
        item.quantity,
        Number(item.unitPrice),
        Number(item.totalPrice),
        registration.status,
      ];
      style_status_cell(row.getCell(9), registration.status);
      row_number += 1;
    }
  }
  finish_detail_sheet(sheet, headers.length, row_number - 6, {
    date_columns: [1],
    currency_columns: [7, 8],
    number_columns: [6],
    text_columns: [2, 5, 9],
    widths: [21, 22, 25, 28, 24, 10, 18, 18, 20],
  });
}

function build_answers_sheet(
  sheet: ExcelJS.Worksheet,
  summary: Awaited<ReturnType<typeof get_event_financial_report>>,
  registrations: any[],
) {
  title_block(sheet, "Jawaban Form Pendaftar", summary);
  const headers = [
    "Waktu Daftar",
    "Kode Registrasi",
    "Nama Pendaftar",
    "Email",
    "Field",
    "Jawaban",
  ];
  sheet.getRow(5).values = headers;
  table_header(sheet, 5, 1, 6);
  let row_number = 6;
  for (const registration of registrations) {
    for (const answer of registration.answers) {
      sheet.getRow(row_number).values = [
        registration.registeredAt,
        registration.registrationCode,
        registration.fullName,
        registration.email,
        answer.formField.label,
        excel_text(json_cell_value(answer.answerJson)),
      ];
      row_number += 1;
    }
  }
  finish_detail_sheet(sheet, headers.length, row_number - 6, {
    date_columns: [1],
    text_columns: [2, 4],
    wrap_columns: [6],
    widths: [21, 22, 25, 30, 28, 55],
  });
}

function title_block(
  sheet: ExcelJS.Worksheet,
  title: string,
  summary: Awaited<ReturnType<typeof get_event_financial_report>>,
) {
  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = {
    name: "Aptos Display",
    size: 20,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF10231B" },
  };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 36;
  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value =
    `${summary.event.name} · ${summary.event.tenant_name}`;
  sheet.getCell("A2").font = { bold: true, color: { argb: "FF2F6B4F" } };
  sheet.mergeCells("A3:H3");
  sheet.getCell("A3").value =
    `Periode: ${format_period(summary.period.from, summary.period.to)} · Dibuat ${new Date().toLocaleString("id-ID", { timeZone: summary.event.timezone })}`;
  sheet.getCell("A3").font = { size: 10, color: { argb: "FF66736B" } };
}

function finish_detail_sheet(
  sheet: ExcelJS.Worksheet,
  column_count: number,
  data_count: number,
  options: {
    date_columns?: number[];
    currency_columns?: number[];
    number_columns?: number[];
    text_columns?: number[];
    wrap_columns?: number[];
    widths: number[];
  },
) {
  const last_row = Math.max(6, 5 + data_count);
  sheet.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];
  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: last_row, column: column_count },
  };
  options.widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  for (const column of options.date_columns ?? []) {
    set_number_format(sheet, 6, last_row, column, "dd mmm yyyy hh:mm");
  }
  for (const column of options.currency_columns ?? []) {
    set_number_format(
      sheet,
      6,
      last_row,
      column,
      '"Rp" #,##0;[Red]("Rp" #,##0);-',
    );
    for_cells(sheet, 6, last_row, column, column, (cell) => {
      cell.alignment = { ...cell.alignment, horizontal: "right" };
    });
  }
  for (const column of options.number_columns ?? []) {
    set_number_format(sheet, 6, last_row, column, "#,##0");
    for_cells(sheet, 6, last_row, column, column, (cell) => {
      cell.alignment = { ...cell.alignment, horizontal: "right" };
    });
  }
  for (const column of options.text_columns ?? []) {
    set_number_format(sheet, 6, last_row, column, "@");
  }
  for (const column of options.wrap_columns ?? []) {
    for_cells(sheet, 6, last_row, column, column, (cell) => {
      cell.alignment = { vertical: "top", wrapText: true };
    });
  }
  for_cells(sheet, 6, last_row, 1, column_count, (cell) => {
    cell.font = {
      name: "Aptos",
      size: 10,
      color: { argb: "FF26342C" },
    };
    cell.alignment = { ...cell.alignment, vertical: "top" };
  });
  for (let row = 6; row <= last_row; row += 1) {
    if (row % 2 === 0) {
      for_cells(sheet, row, row, 1, column_count, (cell) => {
        if (
          cell.fill?.type === "pattern" &&
          cell.fill.pattern === "solid"
        )
          return;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF6F8F5" },
        };
      });
    }
  }
}

function table_header(
  sheet: ExcelJS.Worksheet,
  row: number,
  first_column: number,
  last_column: number,
) {
  for_cells(sheet, row, row, first_column, last_column, (cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2F6B4F" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FFF0B24A" } },
    };
  });
}

function for_cells(
  sheet: ExcelJS.Worksheet,
  first_row: number,
  last_row: number,
  first_column: number,
  last_column: number,
  callback: (cell: ExcelJS.Cell) => void,
) {
  for (let row = first_row; row <= last_row; row += 1) {
    for (let column = first_column; column <= last_column; column += 1) {
      callback(sheet.getCell(row, column));
    }
  }
}

function set_number_format(
  sheet: ExcelJS.Worksheet,
  first_row: number,
  last_row: number,
  column: number,
  format: string,
) {
  for_cells(sheet, first_row, last_row, column, column, (cell) => {
    cell.numFmt = format;
  });
}

function section_header(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF10231B" },
  };
  cell.alignment = { vertical: "middle" };
}

function style_status_cell(cell: ExcelJS.Cell, status?: string | null) {
  const normalized = status?.toLowerCase();
  const palette = ["succeeded", "confirmed", "issued", "checked_in"].includes(
    normalized ?? "",
  )
    ? { fill: "FFDDF5E7", text: "FF17633A" }
    : ["failed", "expired", "cancelled", "rejected"].includes(normalized ?? "")
      ? { fill: "FFFDE3E3", text: "FF9F2525" }
      : { fill: "FFFFF2CD", text: "FF7D5711" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: palette.fill },
  };
  cell.font = { bold: true, color: { argb: palette.text } };
}

function worksheet_options(): Partial<ExcelJS.AddWorksheetOptions> {
  return {
    properties: { defaultRowHeight: 20 },
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  };
}

function registration_where_for_range(
  tenant_id: string,
  event_id: string,
  range: EventReportRange,
): Prisma.RegistrationWhereInput {
  return {
    tenantId: tenant_id,
    eventId: event_id,
    ...registration_date_filter(range),
  };
}

function registration_date_filter(
  range: EventReportRange,
): Prisma.RegistrationWhereInput {
  if (!range.from && !range.to) return {};
  return {
    registeredAt: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    },
  };
}

function payment_where_for_range(
  tenant_id: string,
  event_id: string,
  range: EventReportRange,
): Prisma.PaymentWhereInput {
  const base: Prisma.PaymentWhereInput = {
    tenantId: tenant_id,
    registration: { eventId: event_id },
  };
  if (!range.from && !range.to) return base;
  const date_filter = {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
  return {
    ...base,
    OR: [
      { status: "succeeded", paidAt: date_filter },
      { status: "succeeded", paidAt: null, createdAt: date_filter },
      { status: { not: "succeeded" }, createdAt: date_filter },
    ],
  };
}

function parse_date_param(value: string | null, field: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(
      422,
      "invalid_date_range",
      `Format ${field} tidak valid`,
    );
  }
  return date;
}

function json_cell_value(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return value.map(json_cell_value).join(", ");
  return JSON.stringify(value);
}

function excel_text(value: string): ExcelJS.CellValue {
  return /^\+?[0-9][0-9\s-]{7,}$/.test(value)
    ? { richText: [{ text: value }] }
    : value;
}

function status_label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function format_period(from: Date | null, to: Date | null) {
  const format = (value: Date) =>
    value.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    });
  if (from && to) return `${format(from)} sampai ${format(to)}`;
  if (from) return `Mulai ${format(from)}`;
  if (to) return `Sampai ${format(to)}`;
  return "Semua waktu";
}

function safe_filename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
