import type { EntityRecord } from '@arch-register/api-types/entityContract';

export type EntityOwnValue = { value: number | null; currency: string | null };
export type EntityOwnFields = Record<string, EntityOwnValue>;

const readOwnValue = (raw: unknown): EntityOwnValue => {
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
 * Reads an entity's own values for the given roll-up field ids — the fallback drawer `rollup`
 * items use for a leaf entity (no containment children). The metrics engine's `boxEntityIds`
 * roll-up deliberately excludes the box entity itself from its own aggregation
 * (`collectDescendantIds` in `metricDescendants.ts`), which is correct for map boxes that group
 * differently-schemaed descendants but leaves a childless entity rolling up to "no data" instead
 * of its own directly-set values.
 */
export const extractEntityOwnFields = (
  entity: EntityRecord | null | undefined,
  fieldIds: readonly string[]
): EntityOwnFields => {
  const result: EntityOwnFields = {};
  for (const fieldId of fieldIds) {
    result[fieldId] = readOwnValue(entity?.[fieldId]);
  }
  return result;
};
