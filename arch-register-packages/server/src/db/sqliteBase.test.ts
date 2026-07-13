import { describe, expect, it } from 'vitest';
import { DatabaseError } from './database';
import { normalizeSqliteError } from './sqliteBase';
import { catalogMappers } from '../domain/catalog/db/catalogDatabase';

describe('normalizeSqliteError', () => {
  it('maps primary key constraint failures to unique errors', () => {
    try {
      normalizeSqliteError({ code: 'SQLITE_CONSTRAINT_PRIMARYKEY' });
      expect.unreachable('normalizeSqliteError should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseError);
      expect((error as DatabaseError).code).toBe('unique');
    }
  });

  it('maps foreign key constraint failures to foreign errors', () => {
    try {
      normalizeSqliteError({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' });
      expect.unreachable('normalizeSqliteError should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseError);
      expect((error as DatabaseError).code).toBe('foreign');
    }
  });
});

describe('catalogMappers', () => {
  it('parses valid JSON fields for saved views', () => {
    const result = catalogMappers.savedView({
      id: 'view-1',
      workspace: 'ws-1',
      name: 'My View',
      description: null,
      view_mode: 'grid',
      filters: '{"owner":"team-a"}',
      config: '{"columns":["name"]}',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    });

    expect(result.filters).toEqual({ owner: 'team-a' });
    expect(result.config).toEqual({ columns: ['name'] });
  });

  it('keeps JSON values that PostgreSQL has already decoded', () => {
    const result = catalogMappers.savedView({
      id: 'view-1',
      workspace: 'ws-1',
      name: 'My View',
      description: null,
      view_mode: 'grid',
      filters: { owner: 'team-a' },
      config: { columns: ['name'] },
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z')
    });

    expect(result.filters).toEqual({ owner: 'team-a' });
    expect(result.config).toEqual({ columns: ['name'] });
  });

  it('throws a DatabaseError with field context for malformed JSON', () => {
    try {
      catalogMappers.savedView({
        id: 'view-1',
        workspace: 'ws-1',
        name: 'My View',
        description: null,
        view_mode: 'grid',
        filters: '{',
        config: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      });
      expect.unreachable('catalogMappers.savedView should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseError);
      expect((error as DatabaseError).code).toBe('unknown');
      expect((error as DatabaseError).message).toBe(
        'Invalid JSON in database column "saved_view.filters"'
      );
    }
  });
});
