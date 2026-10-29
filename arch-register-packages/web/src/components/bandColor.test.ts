import { describe, expect, it } from 'vitest';
import { BAND_TONE_COLORS, bandTone, heatColor, minBandTone, ratioColor } from './bandColor';

describe('bandTone', () => {
  const bands = [
    { max: 2, tone: 'bad' as const },
    { max: null, tone: 'good' as const }
  ];

  it('treats max as inclusive by default', () => {
    expect(bandTone(2, bands)).toBe('bad');
    expect(bandTone(2.1, bands)).toBe('good');
  });

  it('treats max as exclusive when requested', () => {
    expect(bandTone(2, bands, { exclusive: true })).toBe('good');
    expect(bandTone(1.9, bands, { exclusive: true })).toBe('bad');
  });

  it('falls back to the last band tone when no band matches', () => {
    expect(bandTone(10, [{ max: 2, tone: 'bad' }])).toBe('bad');
    expect(bandTone(1, [])).toBeNull();
  });
});

describe('minBandTone', () => {
  const bands = [
    { min: -Infinity, tone: 'good' as const },
    { min: 5, tone: 'neutral' as const },
    { min: 10, tone: 'warn' as const },
    { min: 15, tone: 'bad' as const }
  ];

  it('picks the last band whose min the value meets or exceeds', () => {
    expect(minBandTone(0, bands)).toBe('good');
    expect(minBandTone(4, bands)).toBe('good');
    expect(minBandTone(5, bands)).toBe('neutral');
    expect(minBandTone(9, bands)).toBe('neutral');
    expect(minBandTone(10, bands)).toBe('warn');
    expect(minBandTone(14, bands)).toBe('warn');
    expect(minBandTone(15, bands)).toBe('bad');
    expect(minBandTone(25, bands)).toBe('bad');
  });

  it('falls back to the first band tone when no band matches', () => {
    expect(minBandTone(-1, [{ min: 0, tone: 'warn' }])).toBe('warn');
  });
});

describe('heatColor', () => {
  it('bands on the rounded score', () => {
    expect(heatColor(1)).toBe(BAND_TONE_COLORS.bad);
    expect(heatColor(2.4)).toBe(BAND_TONE_COLORS.bad);
    expect(heatColor(2.5)).toBe(BAND_TONE_COLORS.warn);
    expect(heatColor(3.4)).toBe(BAND_TONE_COLORS.warn);
    expect(heatColor(3.5)).toBe(BAND_TONE_COLORS.good);
    expect(heatColor(5)).toBe(BAND_TONE_COLORS.good);
  });
});

describe('ratioColor', () => {
  it('is neutral when total is 0', () => {
    expect(ratioColor(0, 0)).toBe(BAND_TONE_COLORS.neutral);
  });

  it('bands at the 0.5 and 1 boundaries', () => {
    expect(ratioColor(0, 10)).toBe(BAND_TONE_COLORS.bad);
    expect(ratioColor(49, 100)).toBe(BAND_TONE_COLORS.bad);
    expect(ratioColor(1, 2)).toBe(BAND_TONE_COLORS.warn);
    expect(ratioColor(99, 100)).toBe(BAND_TONE_COLORS.warn);
    expect(ratioColor(1, 1)).toBe(BAND_TONE_COLORS.good);
    expect(ratioColor(3, 2)).toBe(BAND_TONE_COLORS.good);
  });
});
