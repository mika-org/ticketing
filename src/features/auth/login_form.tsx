"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Field } from "@/components/ui";
import { api_client, ApiClientError } from "@/lib/api_client";
import { login_schema } from "@/lib/validation";

type LoginValues = z.infer<typeof login_schema>;

export function LoginForm() {
  const router = useRouter();
  const search_params = useSearchParams();
  const [visible, set_visible] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(login_schema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(values: LoginValues) {
    try {
      const response = await api_client<{
        user: { is_super_admin: boolean; tenant_id: string | null };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Login berhasil");
      const fallback = response.data.user.is_super_admin
        ? "/super-admin/dashboard"
        : "/admin/dashboard";
      router.replace(search_params.get("next") ?? fallback);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Login gagal",
      );
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      className="mt-9 space-y-5"
      noValidate
    >
      <Field label="Email" error={form.formState.errors.email?.message}>
        <input
          className="input"
          type="email"
          autoComplete="email"
          placeholder="nama@perusahaan.com"
          {...form.register("email")}
        />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <div className="relative">
          <input
            className="input pr-11"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Minimal 8 karakter"
            {...form.register("password")}
          />
          <button
            type="button"
            onClick={() => set_visible((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-stone-400 hover:text-ink"
            aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          >
            {visible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </Field>
      <Button loading={form.formState.isSubmitting} className="w-full py-3.5">
        <LogIn className="size-4" />
        Masuk ke workspace
      </Button>
      <p className="flex items-center justify-center gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-stone-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Encrypted & secure session
      </p>
    </form>
  );
}
