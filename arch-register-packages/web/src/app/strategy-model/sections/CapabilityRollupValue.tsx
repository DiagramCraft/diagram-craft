import type { ReactNode } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  NumberFormat,
  TableDisplay
} from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { formatStrategyValue } from '../strategyFormat';
import { CapabilityMaturityBar } from './CapabilityMaturityBar';
import { formatGap } from './capabilityGap';

/**
 * Renders a number for a Strategy & Capability Modelling table cell per its configured
 * {@link TableDisplay}: a plain formatted number, a red/amber/green filled `bar` over the field's
 * range, or a signed `delta` coloured by size.
 */
export const CapabilityRollupValue = ({
  value,
  currency,
  display,
  format,
  fieldId,
  schema
}: {
  value: number | null;
  currency: string | null;
  display: TableDisplay;
  format: NumberFormat;
  fieldId: string;
  schema: EntitySchema | undefined;
}): ReactNode => {
  if (display === 'bar') {
    const field = schema?.fields.find(candidate => candidate.id === fieldId);
    const max = field && field.type === 'number' && field.max != null ? field.max : 5;
    return <CapabilityMaturityBar maturity={value} max={max} />;
  }
  if (display === 'delta') {
    const gap = formatGap(value);
    return (
      <span className={gap.className} style={gap.style}>
        {gap.text}
      </span>
    );
  }
  return formatStrategyValue(value, format, currency);
};

/** Whether a table cell with this display should be right-aligned (numeric) — a `bar` is not. */
export const displayIsNumeric = (display: TableDisplay): boolean => display !== 'bar';
