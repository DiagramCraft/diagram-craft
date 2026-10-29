import { describe, expect, test } from 'vitest';
import { withDatabaseName } from './provisionDatabase';

describe('withDatabaseName', () => {
  test('replaces the database name and keeps credentials and host', () => {
    expect(withDatabaseName('postgresql://local:local@localhost:5432/artest', 'db_x')).toBe(
      'postgresql://local:local@localhost:5432/db_x'
    );
  });

  test('keeps query parameters', () => {
    expect(withDatabaseName('postgresql://u:p@h:5432/a?sslmode=require', 'b')).toBe(
      'postgresql://u:p@h:5432/b?sslmode=require'
    );
  });
});
