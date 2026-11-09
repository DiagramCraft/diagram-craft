import { describe, expect, test } from 'vitest';
import { ICON_IDS, ICON_MAP, resolveIcon } from './icons';
import { TbBox, TbLayoutDashboard } from 'react-icons/tb';

describe('resolveIcon', () => {
  test('resolves known ids', () => {
    expect(resolveIcon('server')).toBe(ICON_MAP.server);
    expect(resolveIcon('layout-dashboard')).toBe(TbLayoutDashboard);
  });

  test('falls back for unknown, empty and missing ids', () => {
    expect(resolveIcon('nope')).toBe(TbBox);
    expect(resolveIcon('')).toBe(TbBox);
    expect(resolveIcon(null)).toBe(TbBox);
    expect(resolveIcon(undefined, TbLayoutDashboard)).toBe(TbLayoutDashboard);
  });

  test('exposes ids in kebab-case', () => {
    for (const id of ICON_IDS) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
