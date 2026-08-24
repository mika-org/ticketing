import { LoaderCircle, Sparkles } from "lucide-react";
import { twMerge } from "tailwind-merge";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      className={twMerge(
        variant === "primary" && "button-primary",
        variant === "secondary" && "button-secondary",
        variant === "danger" && "button-primary bg-red-600 hover:bg-red-700",
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span className="mt-1 block text-xs text-stone-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color = [
    "active",
    "published",
    "confirmed",
    "succeeded",
    "issued",
  ].includes(status)
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : ["failed", "cancelled", "rejected", "suspended"].includes(status)
      ? "border-red-200 bg-red-50 text-red-700"
      : ["pending", "pending_payment", "requires_action", "draft"].includes(
            status,
          )
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-stone-200 bg-stone-50 text-stone-600";
  return (
    <span className={twMerge("badge", color)}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={twMerge("animate-pulse rounded-xl bg-stone-200/70", className)}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface dot-grid flex min-h-64 flex-col items-center justify-center overflow-hidden p-8 text-center">
      <div className="icon-tile mb-5 shadow-lg">
        <Sparkles className="size-5" />
      </div>
      <h3 className="text-xl font-black tracking-tight">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-stone-500">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative mb-7 overflow-hidden rounded-[1.75rem] bg-ink px-5 py-6 text-white shadow-soft sm:px-8 sm:py-8">
      <div className="absolute -right-16 -top-28 size-72 rounded-full bg-moss-500/30 blur-3xl" />
      <div className="absolute bottom-0 right-[22%] size-28 rounded-full bg-amber-400/15 blur-2xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="max-w-3xl font-[var(--font-display)] text-3xl font-black tracking-[-0.045em] sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="shrink-0 [&_.button-primary]:bg-white [&_.button-primary]:text-ink [&_.button-primary]:shadow-none [&_.button-secondary]:border-white/15 [&_.button-secondary]:bg-white/10 [&_.button-secondary]:text-white">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
