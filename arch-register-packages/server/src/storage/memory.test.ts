import { describe, expect, it } from 'vitest';
import { MemoryStorage } from './memory';

const buf = (s: string) => Buffer.from(s);

describe('MemoryStorage', () => {
  it('writes, reads and checks existence', async () => {
    const s = new MemoryStorage();
    expect(await s.exists('w', 'p', 'f')).toBe(false);
    await s.write('w', 'p', 'f', buf('hello'));
    expect(await s.exists('w', 'p', 'f')).toBe(true);
    expect((await s.read('w', 'p', 'f')).toString()).toBe('hello');
  });

  it('throws ENOENT for missing files', async () => {
    const s = new MemoryStorage();
    await expect(s.read('w', 'p', 'f')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(s.delete('w', 'p', 'f')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('deleteAll only removes the given project', async () => {
    const s = new MemoryStorage();
    await s.write('w', 'p', 'a', buf('1'));
    await s.write('w', 'p2', 'a', buf('2'));
    await s.deleteAll('w', 'p');
    expect(await s.exists('w', 'p', 'a')).toBe(false);
    expect(await s.exists('w', 'p2', 'a')).toBe(true);
  });

  it('stageWrite rolls back to the previous content', async () => {
    const s = new MemoryStorage();
    await s.write('w', 'p', 'f', buf('old'));
    const staged = await s.stageWrite('w', 'p', 'f', buf('new'));
    expect((await s.read('w', 'p', 'f')).toString()).toBe('old');
    await staged.commit();
    expect((await s.read('w', 'p', 'f')).toString()).toBe('new');
    await staged.rollback();
    expect((await s.read('w', 'p', 'f')).toString()).toBe('old');
  });

  it('stageWrite rollback removes a newly created file', async () => {
    const s = new MemoryStorage();
    const staged = await s.stageWrite('w', 'p', 'f', buf('new'));
    await staged.commit();
    await staged.rollback();
    expect(await s.exists('w', 'p', 'f')).toBe(false);
  });

  it('stageDelete can be rolled back', async () => {
    const s = new MemoryStorage();
    await s.write('w', 'p', 'f', buf('keep'));
    const staged = await s.stageDelete('w', 'p', 'f');
    await staged.commit();
    expect(await s.exists('w', 'p', 'f')).toBe(false);
    await staged.rollback();
    expect((await s.read('w', 'p', 'f')).toString()).toBe('keep');
  });

  it('round-trips through a snapshot', async () => {
    const a = new MemoryStorage();
    await a.write('w', 'p', 'f', buf('data'));
    const b = new MemoryStorage();
    b.importSnapshot(a.exportSnapshot());
    expect((await b.read('w', 'p', 'f')).toString()).toBe('data');
  });
});
