import { describe, expect, it } from 'vitest';
import {
  resolveConfigVariables,
  resolveSidebarVariableReferences
} from './resolveSidebarVariableReferences';

describe('resolveSidebarVariableReferences', () => {
  it('substitutes a known variable', () => {
    expect(resolveSidebarVariableReferences('$apiEntityId', { apiEntityId: 'API-4' })).toBe(
      'API-4'
    );
  });

  it('substitutes a variable embedded in a larger string', () => {
    expect(
      resolveSidebarVariableReferences('schema:"API" AND id = "$apiEntityId"', {
        apiEntityId: 'API-4'
      })
    ).toBe('schema:"API" AND id = "API-4"');
  });

  it('substitutes multiple distinct variables', () => {
    expect(resolveSidebarVariableReferences('$a and $b', { a: '1', b: '2' })).toBe('1 and 2');
  });

  it('leaves an unresolved variable as the literal reference', () => {
    expect(resolveSidebarVariableReferences('$missing', {})).toBe('$missing');
  });

  it('is the identity when the string has no variable references', () => {
    expect(resolveSidebarVariableReferences('plain text', { apiEntityId: 'API-4' })).toBe(
      'plain text'
    );
  });
});

describe('resolveConfigVariables', () => {
  it('resolves string values at the top level', () => {
    expect(resolveConfigVariables({ entityId: '$apiEntityId' }, { apiEntityId: 'API-4' })).toEqual({
      entityId: 'API-4'
    });
  });

  it('resolves string values nested in objects and arrays', () => {
    expect(
      resolveConfigVariables(
        { filters: [{ id: 'f1', value: '$apiEntityId' }] },
        { apiEntityId: 'API-4' }
      )
    ).toEqual({ filters: [{ id: 'f1', value: 'API-4' }] });
  });

  it('leaves non-string values untouched', () => {
    expect(
      resolveConfigVariables({ limit: 8, enabled: true, label: null }, { apiEntityId: 'API-4' })
    ).toEqual({ limit: 8, enabled: true, label: null });
  });
});
