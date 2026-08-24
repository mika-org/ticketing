"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api_client } from "@/lib/api_client";
import { Logo } from "./logo";
import { Skeleton } from "./ui";

type MeData = {
  user: {
    id: string;
    full_name: string;
    email: string;
    is_super_admin: boolean;
  };
  context: {
    tenant_id: string | null;
    role: "super_admin" | "tenant_admin" | "event_staff" | null;
  };
};

export function DashboardShell({
  scope,
  children,
}: {
  scope: "super_admin" | "admin";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobile_open, set_mobile_open] = useState(false);
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api_client<MeData>("/auth/me"),
  });

  useEffect(() => {
    if (me.error && (me.error as any).status === 401)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [me.error, pathname, router]);

  useEffect(() => {
    if (!me.data) return;
    const role = me.data.data.context.role;
    if (scope === "super_admin" && role !== "super_admin")
      router.replace("/admin/dashboard");
    if (
      scope === "admin" &&
      role === "super_admin" &&
      !me.data.data.context.tenant_id
    )
      router.replace("/super-admin/tenants");
  }, [me.data, router, scope]);

  const navigation = useMemo(
    () =>
      scope === "super_admin"
        ? [
            {
              href: "/super-admin/dashboard",
              label: "Ringkasan",
              icon: LayoutDashboard,
            },
            { href: "/super-admin/tenants", label: "Tenant", icon: Building2 },
          ]
        : [
            {
              href: "/admin/dashboard",
              label: "Ringkasan",
              icon: LayoutDashboard,
            },
            { href: "/admin/events", label: "Event", icon: CalendarDays },
            { href: "/admin/reports", label: "Laporan", icon: BarChart3 },
            {
              href: "/admin/settings/payment",
              label: "Pengaturan",
              icon: Settings2,
            },
          ],
    [scope],
  );

  async function logout() {
    await api_client("/auth/logout", { method: "POST", body: "{}" }).catch(
      () => undefined,
    );
    toast.success("Anda telah keluar");
    router.replace("/login");
    router.refresh();
  }

  if (me.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <Logo compact />
          <Skeleton className="mt-5 h-2 w-28" />
        </div>
      </div>
    );
  }

  const first_name = me.data?.data.user.full_name.split(" ")[0] ?? "Operator";
  const current_page =
    navigation.find((item) => pathname.startsWith(item.href))?.label ??
    "Workspace";

  return (
    <div className="min-h-screen bg-paper">
      {mobile_open ? (
        <button
          aria-label="Tutup menu"
          className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-sm lg:hidden"
          onClick={() => set_mobile_open(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[18rem] p-3 transition duration-300 lg:translate-x-0 ${mobile_open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-ink p-5 text-white shadow-2xl">
          <div className="absolute -right-16 -top-20 size-52 rounded-full bg-moss-500/30 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <Logo />
            <button
              className="rounded-xl bg-white/10 p-2 lg:hidden"
              onClick={() => set_mobile_open(false)}
              aria-label="Tutup menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="relative mt-8 rounded-[1.35rem] border border-white/10 bg-white/[.07] p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-amber-400 font-black text-ink">
                {first_name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">
                  {me.data?.data.user.full_name}
                </p>
                <p className="truncate text-[11px] text-white/45">
                  {me.data?.data.user.email}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-[10px] font-black uppercase tracking-[.16em] text-white/45">
                {scope === "super_admin" ? "Super Admin" : "Tenant active"}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-400" />
                Online
              </span>
            </div>
          </div>
          <p className="relative mb-2 mt-7 px-3 text-[9px] font-black uppercase tracking-[.22em] text-white/30">
            Navigasi
          </p>
          <nav className="relative space-y-1.5">
            {navigation.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => set_mobile_open(false)}
                  className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${active ? "bg-white text-ink shadow-lg" : "text-white/55 hover:bg-white/10 hover:text-white"}`}
                >
                  <span
                    className={`grid size-9 place-items-center rounded-xl ${active ? "bg-moss-100 text-moss-700" : "bg-white/[.06]"}`}
                  >
                    <item.icon className="size-4" />
                  </span>
                  {item.label}
                  <ChevronRight
                    className={`ml-auto size-4 transition ${active ? "text-moss-500" : "opacity-0 group-hover:opacity-100"}`}
                  />
                </Link>
              );
            })}
          </nav>
          <div className="relative mt-auto rounded-2xl bg-moss-600 p-4">
            <Sparkles className="size-5 text-amber-400" />
            <p className="mt-4 text-sm font-extrabold">Ready to create?</p>
            <p className="mt-1 text-[11px] leading-5 text-white/60">
              Buat pengalaman event yang lebih seru hari ini.
            </p>
          </div>
          <button
            onClick={logout}
            className="relative mt-3 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-white/45 transition hover:bg-red-500/15 hover:text-red-200"
          >
            <LogOut className="size-4" />
            Keluar
          </button>
        </div>
      </aside>
      <div className="lg:pl-[18rem]">
        <header className="sticky top-0 z-30 flex h-[4.5rem] items-center justify-between border-b border-white/70 bg-paper/75 px-4 backdrop-blur-2xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-2xl border border-white bg-white/80 p-2.5 shadow-sm lg:hidden"
              onClick={() => set_mobile_open(true)}
              aria-label="Buka menu"
            >
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-moss-600">
                Tiketara OS
              </p>
              <p className="text-sm font-extrabold">{current_page}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white bg-white/70 px-3 py-2 text-[11px] font-bold text-stone-500 shadow-sm">
            <ShieldCheck className="size-4 text-emerald-500" />
            <span className="hidden sm:inline">Sesi aman</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 pb-12 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
