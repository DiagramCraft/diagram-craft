import { describe, expect, it } from 'vitest';
import { createEntityQueryDialectAdapter } from './entityQueryIRDialect';
import { createSqlParameterAllocator } from './entityQueryIRSqlContext';

describe('entity query SQL render context', () => {
  it('allocates numbered PostgreSQL parameters in insertion order', () => {
    const allocator = createSqlParameterAllocator(createEntityQueryDialectAdapter('postgres'));

    expect(allocator.add('workspace')).toBe('$1');
    expect(allocator.add(25)).toBe('$2');
    expect(allocator.values).toEqual(['workspace', 25]);
  });

  it('keeps SQLite parameters positional and shares one values array', () => {
    const allocator = createSqlParameterAllocator(createEntityQueryDialectAdapter('sqlite'));

    expect(allocator.add('workspace')).toBe('?');
    expect(allocator.add(25)).toBe('?');
    expect(allocator.values).toEqual(['workspace', 25]);
  });
});
