import {
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  QrCode,
  ScanLine,
  Sparkles,
  Ticket,
  UsersRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

const features = [
  {
    icon: CalendarCheck,
    title: "Build cepat",
    text: "Event, tiket, add-on, dan form dinamis dalam satu flow.",
  },
  {
    icon: QrCode,
    title: "Bayar simpel",
    text: "QRIS realtime dengan status backend yang dapat dipercaya.",
  },
  {
    icon: ScanLine,
    title: "Masuk mulus",
    text: "QR ticket dan check-in cepat untuk tim di venue.",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-moss-100/70 blur-[100px]" />
      <nav className="glass sticky top-4 z-40 mx-auto mt-4 flex max-w-7xl items-center justify-between rounded-[1.4rem] px-4 py-3 sm:px-5">
        <Logo />
        <div className="hidden items-center gap-7 text-sm font-bold text-stone-500 md:flex">
          <a href="#fitur" className="transition hover:text-ink">
            Fitur
          </a>
          <a href="#cara-kerja" className="transition hover:text-ink">
            Cara kerja
          </a>
        </div>
        <Link
          href="/login"
          className="button-primary min-h-10 rounded-xl px-4 py-2"
        >
          Masuk <ArrowUpRight className="size-4" />
        </Link>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-24">
        <div>
          <span className="eyebrow">
            <Sparkles className="size-3" />
            Event ops, but make it fun
          </span>
          <h1 className="mt-7 max-w-4xl font-[var(--font-display)] text-[3.5rem] font-black leading-[.9] tracking-[-.07em] sm:text-[5.4rem] lg:text-[6.2rem]">
            Bikin event.
            <br />
            <span className="text-moss-600">Bukan drama.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base font-medium leading-8 text-stone-500 sm:text-lg">
            Dari landing page sampai check-in, Tiketara merapikan semua hal
            ribet supaya timmu bisa fokus bikin momen yang memorable.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/login" className="button-primary px-6 py-3.5">
              Mulai sekarang <ArrowUpRight className="size-4" />
            </Link>
            <a href="#fitur" className="button-secondary px-6 py-3.5">
              Explore platform
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-5 gap-y-3 text-xs font-bold text-stone-500">
            {["Multi-tenant", "QRIS ready", "Realtime check-in"].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-moss-500" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl py-8">
          <div className="dot-grid absolute -inset-8 -z-10 rounded-[3rem] opacity-40" />
          <div className="float-soft relative mx-auto max-w-md overflow-hidden rounded-[2.2rem] bg-ink p-5 text-white shadow-2xl sm:p-6">
            <div className="absolute -right-20 -top-24 size-64 rounded-full bg-moss-500/50 blur-3xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                  <span className="pulse-ring size-2 rounded-full bg-amber-400" />
                  Live now
                </span>
                <h2 className="mt-7 text-3xl font-black leading-tight tracking-[-.04em]">
                  NEXT GEN
                  <br />
                  CREATIVE FEST
                </h2>
                <p className="mt-3 text-sm text-white/50">
                  Jakarta · 24 September 2026
                </p>
              </div>
              <div className="grid size-12 place-items-center rounded-2xl bg-amber-400 text-ink">
                <Zap className="size-6" fill="currentColor" />
              </div>
            </div>
            <div className="relative mt-10 grid grid-cols-3 gap-2">
              {[
                ["1.2K", "Joined"],
                ["896", "Tickets"],
                ["72%", "Checked-in"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[.07] p-3"
                >
                  <p className="text-xl font-black">{value}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/35">
                    {label}
                  </p>
                </div>
              ))}
            </div>
            <div className="relative mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 text-ink">
              <div className="grid size-11 place-items-center rounded-xl bg-moss-100 text-moss-700">
                <Ticket className="size-5" />
              </div>
              <div>
                <p className="text-xs font-black">Festival Pass</p>
                <p className="mt-0.5 text-[10px] text-stone-400">
                  #TKT-260924-8842
                </p>
              </div>
              <QrCode className="ml-auto size-9" />
            </div>
          </div>
          <div className="absolute -left-3 top-4 rounded-2xl bg-amber-400 p-4 text-ink shadow-xl sm:-left-8">
            <UsersRound className="size-5" />
            <p className="mt-3 text-xl font-black">+28%</p>
            <p className="text-[9px] font-bold uppercase tracking-wider">
              conversion
            </p>
          </div>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <span className="eyebrow">Satu platform</span>
            <h2 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-5xl">
              Semua flow. Tetap flow.
            </h2>
          </div>
          <p className="hidden max-w-sm text-sm leading-6 text-stone-500 md:block">
            Tools serius dengan experience yang tidak terasa seperti software
            kantor.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`surface group p-6 transition duration-300 hover:-translate-y-1 ${index === 1 ? "bg-moss-600 text-white" : ""}`}
            >
              <div
                className={`grid size-12 place-items-center rounded-2xl ${index === 1 ? "bg-amber-400 text-ink" : "bg-moss-50 text-moss-700"}`}
              >
                <feature.icon className="size-6" />
              </div>
              <p
                className={`mt-12 text-[10px] font-black uppercase tracking-[.2em] ${index === 1 ? "text-white/45" : "text-stone-400"}`}
              >
                0{index + 1}
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">
                {feature.title}
              </h3>
              <p
                className={`mt-2 text-sm leading-6 ${index === 1 ? "text-white/60" : "text-stone-500"}`}
              >
                {feature.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="cara-kerja"
        className="mx-4 mb-4 overflow-hidden rounded-[2rem] bg-ink text-white sm:mx-6 sm:rounded-[2.6rem]"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-6 py-14 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:py-20">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-400">
              Your event starts here
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-black tracking-[-.05em] sm:text-6xl">
              Siap bikin event yang orang tunggu?
            </h2>
          </div>
          <Link
            href="/login"
            className="button-primary bg-white text-ink shadow-none hover:bg-amber-400"
          >
            Buka dashboard <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
