import Link from "next/link";
import { Ticket } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-3 font-black tracking-[-0.04em]"
    >
      <span className="relative grid size-10 place-items-center overflow-hidden rounded-[1rem] bg-moss-600 text-white shadow-glow transition group-hover:-rotate-6 group-hover:scale-105">
        <span className="absolute -right-2 -top-2 size-5 rounded-full bg-amber-400" />
        <Ticket className="relative size-5" strokeWidth={2.5} />
      </span>
      {!compact ? (
        <span className="text-xl">
          tiketara<span className="text-moss-500">.</span>
        </span>
      ) : null}
    </Link>
  );
}
