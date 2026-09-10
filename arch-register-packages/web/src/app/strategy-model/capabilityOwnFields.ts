import type { EntityRecord } from '@arch-register/api-types/entityContract';

export type CapabilityOwnValue = { value: number | null; currency: string | null };
export type CapabilityOwnFields = Record<string, CapabilityOwnValue>;

const readOwnValue = (raw: unknown): CapabilityOwnValue => {
  if (raw != null && typeof raw === 'object' && 'amount' in raw) {
    const money = raw as { amount?: unknown; currency?: unknown };
    return {
      value: typeof money.amount === 'number' ? money.amount : null,
      currency: typeof money.currency === 'string' ? money.currency : null
    };
  }
  return { value: typeof raw === 'number' ? raw : null, currency: null };
};

/**
 * Reads a Business Capability entity's own values for the given roll-up field ids — the fallback
 * `useCapabilityRollup(s)` use for a capability with no children. The metrics engine's
 * `boxEntityIds` roll-up deliberately excludes the box entity itself from its own aggregation
 * (`collectDescendantIds` in `metricDescendants.ts`), which is correct for map boxes that group
 * differently-schemaed descendants but leaves a childless Business Capability rolling up to
 * "no data" instead of its own directly-set values.
 */
export const extractCapabilityOwnFields = (
  entity: EntityRecord | null | undefined,
  fieldIds: readonly string[]
): CapabilityOwnFields => {
  const result: CapabilityOwnFields = {};
  for (const fieldId of fieldIds) {
    result[fieldId] = readOwnValue(entity?.[fieldId]);
  }
  return result;
};
