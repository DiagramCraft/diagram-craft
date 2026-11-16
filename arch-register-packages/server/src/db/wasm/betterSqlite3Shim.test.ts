import { describe, expect, it, beforeEach } from 'vitest';
import Database from './betterSqlite3Shim';
import { normalizeSqliteError } from '../sqliteBase';
import { DatabaseError } from '../database';

const kindOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    try {
      normalizeSqliteError(e);
    } catch (n) {
      return (n as DatabaseError).code;
    }
  }
  return undefined;
};

describe('better-sqlite3 shim', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE parent (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, age INTEGER CHECK (age >= 0));
      CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id));
    `);
  });

  it('binds params, returns run results and rows', () => {
    const r = db.prepare('INSERT INTO parent (name, age) VALUES (?, ?)').run('a', 3);
    expect(r.changes).toBe(1);
    expect(Number(r.lastInsertRowid)).toBe(1);
    expect(db.prepare('SELECT * FROM parent WHERE name = ?').get('a')).toEqual({
      id: 1,
      name: 'a',
      age: 3
    });
    expect(db.prepare('SELECT * FROM parent').all()).toHaveLength(1);
  });

  it('returns undefined for get without a row, and binds booleans/undefined', () => {
    expect(db.prepare('SELECT * FROM parent WHERE id = ?').get(99)).toBeUndefined();
    db.prepare('INSERT INTO parent (name, age) VALUES (?, ?)').run('b', undefined);
    expect(db.prepare('SELECT age FROM parent').get()).toEqual({ age: null });
    expect(db.prepare('SELECT ? AS v').get(true)).toEqual({ v: 1 });
  });

  it('supports JSON functions', () => {
    expect(db.prepare(`SELECT json_extract('{"a":[1,2]}', '$.a[1]') AS v`).get()).toEqual({ v: 2 });
  });

  it('maps constraint errors to DatabaseError kinds', () => {
    db.prepare('INSERT INTO parent (name, age) VALUES (?, ?)').run('a', 1);
    expect(kindOf(() => db.prepare('INSERT INTO parent (name) VALUES (?)').run('a'))).toBe(
      'unique'
    );
    expect(kindOf(() => db.prepare('INSERT INTO parent (name) VALUES (NULL)').run())).toBe(
      'notnull'
    );
    expect(
      kindOf(() => db.prepare('INSERT INTO parent (name, age) VALUES (?, ?)').run('c', -1))
    ).toBe('check');
    expect(kindOf(() => db.prepare('INSERT INTO child (parent_id) VALUES (?)').run(42))).toBe(
      'foreign'
    );
  });

  it('commits and rolls back transactions, including nested ones', () => {
    const insert = db.prepare('INSERT INTO parent (name) VALUES (?)');
    db.transaction(() => insert.run('x'))();
    expect(() =>
      db.transaction(() => {
        insert.run('y');
        db.transaction(() => {
          insert.run('z');
          throw new Error('inner');
        })();
      })()
    ).toThrow('inner');
    expect(db.prepare('SELECT name FROM parent').all()).toEqual([{ name: 'x' }]);
  });

  it('allows raw BEGIN/SAVEPOINT via exec', () => {
    db.exec('BEGIN IMMEDIATE');
    db.exec('SAVEPOINT s1');
    db.prepare('INSERT INTO parent (name) VALUES (?)').run('q');
    db.exec('ROLLBACK TO SAVEPOINT s1');
    db.exec('RELEASE SAVEPOINT s1');
    db.exec('COMMIT');
    expect(db.prepare('SELECT * FROM parent').all()).toEqual([]);
  });
});
