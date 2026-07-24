import type { TElement } from 'platejs';

export const CALLOUT_VARIANTS = ['info', 'warning', 'danger', 'success', 'note'] as const;

export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export const isCalloutVariant = (value: unknown): value is CalloutVariant =>
  typeof value === 'string' && (CALLOUT_VARIANTS as readonly string[]).includes(value);

export interface CalloutSlateElement extends TElement {
  variant?: CalloutVariant;
}
