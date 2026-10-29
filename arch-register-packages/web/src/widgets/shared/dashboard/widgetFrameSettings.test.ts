import { describe, expect, test } from 'vitest';
import type { DashboardWidgetSpec } from '../types';
import { normalizeFrame, resolveWidgetFrame } from './widgetFrameSettings';

const spec = (frame?: DashboardWidgetSpec<any>['frame']) => ({ frame }) as DashboardWidgetSpec<any>;

describe('resolveWidgetFrame', () => {
  test('uses defaults when nothing is overridden', () => {
    expect(resolveWidgetFrame(spec(), undefined)).toEqual({
      title: undefined,
      iconName: undefined,
      showIcon: true,
      style: 'header',
      tint: undefined,
      padded: true
    });
  });

  test('instance style overrides the default', () => {
    expect(resolveWidgetFrame(spec(), { style: 'frame' }).style).toBe('frame');
  });

  test('legacy showFrame maps to a style', () => {
    expect(resolveWidgetFrame(spec(), { showFrame: false }).style).toBe('none');
    expect(resolveWidgetFrame(spec(), { showFrame: true }).style).toBe('header');
  });

  test('style wins over legacy showFrame', () => {
    expect(resolveWidgetFrame(spec(), { style: 'frame', showFrame: false }).style).toBe('frame');
  });

  test('tint is passed through', () => {
    expect(resolveWidgetFrame(spec(), { tint: 'blue' }).tint).toBe('blue');
  });

  test('icon override enables icon even when spec hides it', () => {
    const s = spec({ showIcon: false });
    expect(resolveWidgetFrame(s, undefined).showIcon).toBe(false);
    expect(resolveWidgetFrame(s, { icon: 'TbApi' })).toMatchObject({
      showIcon: true,
      iconName: 'TbApi'
    });
  });

  test('blank title is ignored', () => {
    expect(resolveWidgetFrame(spec(), { title: '  ' }).title).toBeUndefined();
  });
});

describe('normalizeFrame', () => {
  test('drops empty values', () => {
    expect(normalizeFrame({ title: '', style: undefined })).toBeUndefined();
    expect(normalizeFrame({ title: 'A', style: 'none', tint: 'red' })).toEqual({
      title: 'A',
      style: 'none',
      tint: 'red'
    });
  });

  test('migrates legacy showFrame to style', () => {
    expect(normalizeFrame({ showFrame: false })).toEqual({ style: 'none' });
  });
});
