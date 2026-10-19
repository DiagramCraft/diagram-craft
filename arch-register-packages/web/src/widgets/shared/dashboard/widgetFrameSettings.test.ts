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
      showFrame: true,
      padded: true
    });
  });

  test('instance showFrame overrides the default', () => {
    expect(resolveWidgetFrame(spec(), { showFrame: false }).showFrame).toBe(false);
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
    expect(normalizeFrame({ title: '', showFrame: undefined })).toBeUndefined();
    expect(normalizeFrame({ title: 'A', showFrame: false })).toEqual({
      title: 'A',
      showFrame: false
    });
  });
});
