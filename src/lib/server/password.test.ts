import { describe, expect, it } from "vitest";
import {
  hash_password,
  password_hash_uses_bcrypt,
  verify_password,
} from "./password";

describe("password hashing", () => {
  it("menghasilkan dan memverifikasi bcrypt cost 10", async () => {
    const password = "Sangat-Rahasia-123!";
    const password_hash = await hash_password(password);

    expect(password_hash).toMatch(/^\$2[aby]\$10\$/);
    expect(password_hash_uses_bcrypt(password_hash)).toBe(true);
    await expect(verify_password(password_hash, password)).resolves.toBe(true);
    await expect(
      verify_password(password_hash, "password-salah"),
    ).resolves.toBe(false);
  });
});
