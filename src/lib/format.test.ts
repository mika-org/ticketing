import { describe, expect, it } from 'vitest';
import { mask_email, normalize_whatsapp } from './format';

describe('format helpers', () => {
  it('normalizes Indonesian WhatsApp numbers', () => expect(normalize_whatsapp('0812-3456')).toBe('628123456'));
  it('masks email identity', () => expect(mask_email('participant@example.com')).toBe('pa***@example.com'));
});
