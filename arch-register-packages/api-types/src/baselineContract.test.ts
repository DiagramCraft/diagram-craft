import { describe, expect, it } from 'vitest';
import { baselineContract } from './baselineContract';

describe('baseline list request schema', () => {
  const inputSchema = baselineContract.baselines.list['~orpc'].inputSchema;
  if (!inputSchema) throw new Error('Baseline list input schema is not defined');
  const params = { workspace: 'workspace-1' };

  it('reads serialized includeDeleted values literally', () => {
    expect(inputSchema.parse({ params, query: { includeDeleted: 'true' } }).query).toEqual({
      includeDeleted: true
    });
    // "false" must not be coerced to true: the web client always sends includeDeleted=false.
    expect(inputSchema.parse({ params, query: { includeDeleted: 'false' } }).query).toEqual({
      includeDeleted: false
    });
  });

  it('leaves includeDeleted undefined when absent', () => {
    expect(inputSchema.parse({ params, query: {} }).query).toEqual({ includeDeleted: undefined });
  });
});
