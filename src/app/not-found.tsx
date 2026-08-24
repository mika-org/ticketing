import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5">
      <div className="absolute size-[30rem] rounded-full bg-moss-100 blur-[100px]" />
      <div className="relative max-w-lg text-center">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-400 text-ink shadow-xl">
          <Compass className="size-6" />
        </div>
        <p className="mt-7 text-[10px] font-black uppercase tracking-[.22em] text-moss-600">
          404 · Lost in the crowd
        </p>
        <h1 className="mt-4 text-5xl font-black leading-[.95] tracking-[-.06em] sm:text-6xl">
          Halaman ini tidak ada di guest list.
        </h1>
        <p className="mt-5 text-sm font-medium text-stone-500">
          Periksa lagi alamatnya atau kembali ke halaman utama.
        </p>
        <Link href="/" className="button-primary mt-8">
          <ArrowLeft className="size-4" />
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
