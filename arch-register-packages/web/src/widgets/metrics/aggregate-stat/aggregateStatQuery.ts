import { z } from 'zod';

export const aggregateStatDisplaySchema = z.enum(['count', 'percent', 'ofTotal']);

export type AggregateStatDisplay = z.infer<typeof aggregateStatDisplaySchema>;

export const aggregateStatSeveritySchema = z.object({
  warnAt: z.number().optional(),
  critAt: z.number().optional(),
  direction: z.enum(['above', 'below']).optional()
});

export type AggregateStatSeverity = z.infer<typeof aggregateStatSeveritySchema>;

export type AggregateStatTone = 'normal' | 'warn' | 'crit';

export const isQueryStatConfig = (config: { query?: string }): boolean =>
  typeof config.query === 'string' && config.query.trim() !== '';

export const formatStatValue = (
  display: AggregateStatDisplay,
  matched: number,
  total: number | undefined
): string => {
  if (display === 'percent') {
    return total && total > 0 ? `${Math.round((matched / total) * 100)}%` : '—';
  }
  return String(matched);
};

export const statNumericValue = (
  display: AggregateStatDisplay,
  matched: number,
  total: number | undefined
): number | undefined => {
  if (display === 'percent') {
    return total && total > 0 ? Math.round((matched / total) * 100) : undefined;
  }
  return matched;
};

export const statTone = (
  value: number | undefined,
  severity: AggregateStatSeverity | undefined
): AggregateStatTone => {
  if (value === undefined || !severity) return 'normal';
  const beyond = (threshold: number | undefined) =>
    threshold !== undefined &&
    (severity.direction === 'below' ? value <= threshold : value >= threshold);
  if (beyond(severity.critAt)) return 'crit';
  if (beyond(severity.warnAt)) return 'warn';
  return 'normal';
};

export const renderStatSubtext = (
  template: string | undefined,
  subCount: number | undefined,
  matched: number,
  total: number | undefined,
  subSum?: string
): string | undefined => {
  const source = template?.trim();
  if (!source) return undefined;
  return source
    .replaceAll('{subSum}', subSum ?? '—')
    .replaceAll('{sub}', String(subCount ?? '—'))
    .replaceAll('{count}', String(matched))
    .replaceAll('{total}', String(total ?? '—'));
};
