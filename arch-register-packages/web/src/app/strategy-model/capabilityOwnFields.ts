import type { EntityRecord } from '@arch-register/api-types/entityContract';

export type CapabilityOwnFields = {
  maturity: number | null;
  maturityTarget: number | null;
  risk: number | null;
  gap: number | null;
  investment: { amount: number; currency: string } | null;
};

const numberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/**
 * Reads a Business Capability entity's own `maturity`/`maturity_target`/`risk`/`gap`/
 * `annual_investment` field values — the fallback source `useCapabilityRollup(s)` fall back to for
 * a capability with no children. The metrics engine's `boxEntityIds` rollup deliberately excludes
 * the box entity itself from its own aggregation (`collectDescendantIds` in
 * `metricDescendants.ts`, "the box entity itself is excluded" — correct for map boxes that group
 * differently-schemaed descendants, but a Business Capability leaf has no descendants at all, so
 * without this fallback its own directly-set values would roll up to "no data" instead of
 * themselves).
 */
export const extractCapabilityOwnFields = (
  entity: EntityRecord | null | undefined
): CapabilityOwnFields => {
  const investment = entity?.annual_investment as
    | { amount?: unknown; currency?: unknown }
    | undefined;
  return {
    maturity: numberOrNull(entity?.maturity),
    maturityTarget: numberOrNull(entity?.maturity_target),
    risk: numberOrNull(entity?.risk),
    gap: numberOrNull(entity?.gap),
    investment:
      typeof investment?.amount === 'number' && typeof investment.currency === 'string'
        ? { amount: investment.amount, currency: investment.currency }
        : null
  };
};
