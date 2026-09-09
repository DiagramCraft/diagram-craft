import type { ReactNode } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RollupField } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { formatStrategyValue } from '../strategyFormat';
import { CapabilityMaturityBar } from './CapabilityMaturityBar';
import { formatGap } from './capabilityGap';

/**
 * Renders a roll-up value for a Strategy & Capability Modelling table cell per the roll-up's
 * configured `display` (@see RollupField): a plain formatted number, a red/amber/green filled
 * `bar` over the field's range, or a signed `delta` coloured by size.
 */
export const CapabilityRollupValue = ({
  value,
  currency,
  rollup,
  schema
}: {
  value: number | null;
  currency: string | null;
  rollup: RollupField;
  schema: EntitySchema | undefined;
}): ReactNode => {
  if (rollup.display === 'bar') {
    const field = schema?.fields.find(candidate => candidate.id === rollup.fieldId);
    const max = field && field.type === 'number' && field.max != null ? field.max : 5;
    return <CapabilityMaturityBar maturity={value} max={max} />;
  }
  if (rollup.display === 'delta') {
    const gap = formatGap(value);
    return (
      <span className={gap.className} style={gap.style}>
        {gap.text}
      </span>
    );
  }
  return formatStrategyValue(value, rollup.format, currency);
};

/** Whether a roll-up column should be right-aligned (numeric) — a `bar` is not. */
export const rollupIsNumeric = (rollup: RollupField): boolean => rollup.display !== 'bar';
