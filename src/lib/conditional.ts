export type ConditionalRule = {
  field_key: string;
  operator: 'equals' | 'not_equals' | 'in' | 'contains';
  value: unknown;
};

export function conditional_visible(rule: ConditionalRule | null | undefined, values: Record<string, unknown>) {
  if (!rule) return true;
  const current = values[rule.field_key];
  if (rule.operator === 'equals') return current === rule.value;
  if (rule.operator === 'not_equals') return current !== rule.value;
  if (rule.operator === 'in') return Array.isArray(rule.value) && rule.value.includes(current);
  if (rule.operator === 'contains') return Array.isArray(current) ? current.includes(rule.value) : String(current ?? '').includes(String(rule.value ?? ''));
  return false;
}
