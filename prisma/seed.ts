import { PrismaClient } from "@prisma/client";
import { hash_password } from "../src/lib/server/password";

const prisma = new PrismaClient();
const forbidden_passwords = new Set([
  "ChangeMe-12345",
  "replace-with-a-strong-password",
]);

function required_env(name: "SUPER_ADMIN_EMAIL" | "SUPER_ADMIN_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diisi di .env`);
  return value;
}

async function main() {
  const email = required_env("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = required_env("SUPER_ADMIN_PASSWORD");
  const full_name = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";

  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new Error("SUPER_ADMIN_EMAIL tidak valid");
  if (password.length < 12 || forbidden_passwords.has(password)) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD minimal 12 karakter dan tidak boleh berupa placeholder",
    );
  }

  const passwordHash = await hash_password(password);

  const current = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
  });

  if (current) {
    await prisma.user.update({
      where: { id: current.id },
      data: {
        fullName: full_name,
        email,
        passwordHash,
        isSuperAdmin: true,
        status: "active",
      },
    });
  } else {
    await prisma.user.create({
      data: {
        fullName: full_name,
        email,
        passwordHash,
        isSuperAdmin: true,
        status: "active",
      },
    });
  }

  console.log(
    `Super Admin siap: ${email} (${current ? "diperbarui" : "dibuat"})`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
