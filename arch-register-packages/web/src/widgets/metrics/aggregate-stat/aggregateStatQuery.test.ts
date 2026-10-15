import { describe, expect, it } from 'vitest';
import {
  formatStatValue,
  isQueryStatConfig,
  renderStatSubtext,
  statNumericValue,
  statTone
} from './aggregateStatQuery';

describe('aggregateStatQuery', () => {
  it('detects query-mode configs', () => {
    expect(isQueryStatConfig({ query: 'schema:"Data Flow"' })).toBe(true);
    expect(isQueryStatConfig({ query: '  ' })).toBe(false);
    expect(isQueryStatConfig({})).toBe(false);
  });

  it('formats count and percent values', () => {
    expect(formatStatValue('count', 7, undefined)).toBe('7');
    expect(formatStatValue('percent', 1, 3)).toBe('33%');
    expect(formatStatValue('percent', 0, 0)).toBe('—');
    expect(statNumericValue('percent', 0, 0)).toBeUndefined();
  });

  it('derives tone from thresholds in both directions', () => {
    expect(statTone(0, { warnAt: 1 })).toBe('normal');
    expect(statTone(2, { warnAt: 1, critAt: 5 })).toBe('warn');
    expect(statTone(5, { warnAt: 1, critAt: 5 })).toBe('crit');
    expect(statTone(40, { warnAt: 80, critAt: 50, direction: 'below' })).toBe('crit');
    expect(statTone(70, { warnAt: 80, critAt: 50, direction: 'below' })).toBe('warn');
    expect(statTone(undefined, { warnAt: 1 })).toBe('normal');
  });

  it('renders subtext templates', () => {
    expect(renderStatSubtext('{sub} highly sensitive', 3, 10, undefined)).toBe(
      '3 highly sensitive'
    );
    expect(renderStatSubtext('{count} of {total} tested', undefined, 4, 9)).toBe('4 of 9 tested');
    expect(renderStatSubtext('', 1, 1, 1)).toBeUndefined();
    expect(renderStatSubtext('{subSum} at stake', 2, 3, undefined, '$5')).toBe('$5 at stake');
  });
});
