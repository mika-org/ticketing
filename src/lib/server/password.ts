import * as bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 10;

export function hash_password(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verify_password(password_hash: string, password: string) {
  if (password_hash.startsWith("$2")) {
    return bcrypt.compare(password, password_hash);
  }

  // Compatibility for existing accounts. A successful login immediately
  // replaces this legacy hash with bcrypt in the login route.
  if (password_hash.startsWith("$argon2")) {
    const { verify: verify_argon2 } = await import("@node-rs/argon2");
    return verify_argon2(password_hash, password);
  }

  return false;
}

export function password_hash_uses_bcrypt(password_hash: string) {
  return /^\$2[aby]\$10\$/.test(password_hash);
}
