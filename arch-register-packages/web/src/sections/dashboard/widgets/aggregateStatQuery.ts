export type AggregateStatDisplay = 'count' | 'percent' | 'ofTotal';

export type AggregateStatSeverity = {
  warnAt?: number;
  critAt?: number;
  direction?: 'above' | 'below';
};

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
  total: number | undefined
): string | undefined => {
  const source = template?.trim();
  if (!source) return undefined;
  return source
    .replaceAll('{sub}', String(subCount ?? '—'))
    .replaceAll('{count}', String(matched))
    .replaceAll('{total}', String(total ?? '—'));
};
