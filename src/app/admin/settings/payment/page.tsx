import type { Metadata } from "next";
import { TenantPaymentSettings } from "@/features/settings/payment_settings";

export const metadata: Metadata = { title: "Pengaturan Pembayaran" };

export default function PaymentSettingsPage() {
  return <TenantPaymentSettings />;
}
