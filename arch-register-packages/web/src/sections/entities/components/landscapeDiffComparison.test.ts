import { describe, expect, it } from 'vitest';
import { classifyFieldChange, classifyRow } from './landscapeDiffComparison';

describe('classifyFieldChange', () => {
  it('attributes a change to the project that moved away from the live value', () => {
    expect(classifyFieldChange({ current: 'a', from: 'b', to: 'a' })).toBe('this');
    expect(classifyFieldChange({ current: 'a', from: 'a', to: 'b' })).toBe('other');
  });

  it('flags a conflict when both projects changed the value differently', () => {
    expect(classifyFieldChange({ current: 'a', from: 'b', to: 'c' })).toBe('conflict');
  });
});

describe('classifyRow', () => {
  it('lets a conflict dominate', () => {
    expect(classifyRow(['this', 'conflict', 'other'])).toBe('conflict');
  });

  it('reports both projects when they touch different fields', () => {
    expect(classifyRow(['this', 'other'])).toBe('both');
  });

  it('reports a single owner, or null when there are no field changes', () => {
    expect(classifyRow(['this', 'this'])).toBe('this');
    expect(classifyRow(['other'])).toBe('other');
    expect(classifyRow([])).toBeNull();
  });
});
