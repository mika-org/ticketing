import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { ApiError } from './api';

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function encryption_key() {
  const encoded = process.env.APP_ENCRYPTION_KEY;
  if (!encoded) throw new ApiError(503, 'encryption_not_configured', 'Kunci enkripsi aplikasi belum dikonfigurasi');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new ApiError(503, 'encryption_not_configured', 'Kunci enkripsi aplikasi tidak valid');
  return key;
}

export function encrypt_secret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryption_key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decrypt_secret(value: string) {
  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) throw new ApiError(500, 'invalid_ciphertext', 'Data terenkripsi tidak valid');
  const decipher = createDecipheriv('aes-256-gcm', encryption_key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function ticket_token(ticket_id: string) {
  const key = process.env.QR_SIGNING_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'unsafe-development-qr-secret';
  const signature = createHmac('sha256', key).update(ticket_id).digest('base64url');
  return `${Buffer.from(ticket_id).toString('base64url')}.${signature}`;
}
