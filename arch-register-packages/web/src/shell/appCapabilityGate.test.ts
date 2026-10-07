import { describe, expect, test } from 'vitest';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';
import { isAppEnabled } from './appCapabilityGate';

const config = (type: string, valid: boolean) =>
  ({ type, valid, bindings: {} }) as unknown as WorkspaceCapabilityConfiguration;

describe('isAppEnabled', () => {
  test('always-on apps are enabled without configurations', () => {
    expect(isAppEnabled({ enablement: 'always' }, undefined)).toBe(true);
  });

  test('capability apps need a valid configuration of their type', () => {
    const app = { enablement: { capabilityType: 'x' } } as const;
    expect(isAppEnabled(app, [config('x', true)])).toBe(true);
    expect(isAppEnabled(app, [config('x', false)])).toBe(false);
    expect(isAppEnabled(app, [config('y', true)])).toBe(false);
    expect(isAppEnabled(app, undefined)).toBe(false);
  });

  test('resolveConfig takes precedence', () => {
    const app = {
      enablement: { capabilityType: 'x' },
      resolveConfig: () => null
    } as const;
    expect(isAppEnabled(app, [config('x', true)])).toBe(false);
  });
});
