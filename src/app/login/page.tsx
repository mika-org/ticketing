import type { Metadata } from "next";
import { CheckCircle2, Sparkles, Zap } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login_form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden p-3 sm:p-5">
      <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-amber-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 size-[28rem] rounded-full bg-moss-500/25 blur-3xl" />
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1480px] overflow-hidden rounded-[2rem] border border-white/80 bg-white/65 shadow-2xl backdrop-blur-2xl lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-ink p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-36 -top-36 size-[28rem] rounded-full bg-moss-500/35 blur-3xl" />
          <div className="dot-grid absolute inset-0 opacity-[.12] invert" />
          <div className="relative">
            <Logo />
          </div>
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-amber-400">
              <Sparkles className="size-3" />
              Command center
            </span>
            <h1 className="mt-7 text-5xl font-black leading-[.95] tracking-[-.06em] xl:text-7xl">
              Run the event.
              <br />
              <span className="text-moss-500">Own the moment.</span>
            </h1>
            <p className="mt-6 max-w-lg text-sm font-medium leading-7 text-white/50">
              Semua insight, pembayaran, tiket, dan check-in dalam satu
              workspace yang benar-benar enak dipakai.
            </p>
            <div className="mt-8 flex gap-5 text-xs font-bold text-white/55">
              {["Realtime", "Secure", "Multi-tenant"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-amber-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="relative flex items-center justify-between text-[10px] font-bold uppercase tracking-[.16em] text-white/25">
            <span>Tiketara event OS</span>
            <Zap className="size-4 text-amber-400" />
          </div>
        </section>
        <section className="flex items-center justify-center px-5 py-10 sm:px-10 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <Logo />
            </div>
            <span className="eyebrow">Welcome back</span>
            <h2 className="mt-5 text-4xl font-black tracking-[-.05em] sm:text-5xl">
              Masuk & lanjut bikin impact.
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-stone-500">
              Gunakan akun Super Admin, Admin Tenant, atau event crew.
            </p>
            <Suspense
              fallback={
                <div className="mt-9 h-64 animate-pulse rounded-3xl bg-moss-50" />
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
