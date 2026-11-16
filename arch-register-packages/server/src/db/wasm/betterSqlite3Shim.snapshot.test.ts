import { describe, expect, it } from 'vitest';
import Database from './betterSqlite3Shim';

describe('better-sqlite3 shim snapshots', () => {
  it('restores serialized content into a new database', () => {
    const source = new Database(':memory:');
    source.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    source.prepare('INSERT INTO t (name) VALUES (?)').run('a');

    const restored = new Database(':memory:', { snapshot: source.serialize() });
    expect(restored.prepare('SELECT name FROM t').all()).toEqual([{ name: 'a' }]);

    // The copy is independent of the source
    restored.prepare('INSERT INTO t (name) VALUES (?)').run('b');
    expect(source.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 1 });
  });

  it('totalChanges only moves when rows are written', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    const before = db.totalChanges();
    db.prepare('SELECT * FROM t').all();
    expect(db.totalChanges()).toBe(before);
    db.prepare('INSERT INTO t DEFAULT VALUES').run();
    expect(db.totalChanges()).toBeGreaterThan(before);
  });
});
