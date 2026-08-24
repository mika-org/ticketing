export function format_idr(value: number | string) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

export function format_date(value: string | Date, timezone = 'Asia/Jakarta') {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value));
}

export function normalize_whatsapp(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return digits;
}

export function mask_email(value: string) {
  const [name, domain] = value.split('@');
  return `${name?.slice(0, 2) ?? ''}***@${domain ?? ''}`;
}
