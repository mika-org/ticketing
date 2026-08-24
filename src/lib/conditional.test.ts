import { describe, expect, it } from 'vitest';
import { conditional_visible } from './conditional';

describe('conditional_visible', () => {
  it('evaluates controlled equality and membership rules without executing code', () => {
    expect(conditional_visible({ field_key: 'shirt', operator: 'equals', value: true }, { shirt: true })).toBe(true);
    expect(conditional_visible({ field_key: 'ticket', operator: 'in', value: ['vip'] }, { ticket: 'regular' })).toBe(false);
  });
});
