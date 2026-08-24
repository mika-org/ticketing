"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { Logo } from "@/components/logo";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5">
      <div className="absolute size-[28rem] rounded-full bg-red-100/70 blur-[90px]" />
      <div className="surface relative w-full max-w-md p-8 text-center sm:p-10">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle className="size-6" />
        </div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-[.2em] text-red-500">
          Something went off track
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-.04em]">
          Terjadi gangguan.
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-500">
          Coba muat ulang bagian ini. Jika berulang, sertakan correlation ID
          dari respons API.
        </p>
        <Button className="mt-7 w-full" onClick={reset}>
          <RotateCcw className="size-4" />
          Coba lagi
        </Button>
      </div>
    </main>
  );
}
