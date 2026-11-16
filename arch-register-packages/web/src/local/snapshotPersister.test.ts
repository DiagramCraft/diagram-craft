import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { createSnapshotPersister } from './snapshotPersister';

describe('createSnapshotPersister', () => {
  let count: number;
  let save: Mock<() => Promise<unknown>>;

  const make = () =>
    createSnapshotPersister({ sources: [{ changeCount: () => count }], save, delayMs: 2000 });

  beforeEach(() => {
    vi.useFakeTimers();
    count = 0;
    save = vi.fn().mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('does not save when nothing changed', async () => {
    const p = make();
    p.notify();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('debounces writes into a single save', async () => {
    const p = make();
    count = 1;
    p.notify();
    count = 2;
    p.notify();
    await vi.advanceTimersByTimeAsync(1999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('flush saves immediately and only once', async () => {
    const p = make();
    count = 1;
    p.notify();
    await p.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves again when changes arrive during a save', async () => {
    let release!: () => void;
    save.mockImplementationOnce(() => new Promise<void>(r => (release = r)));
    const p = make();
    count = 1;
    const first = p.flush();
    count = 2;
    const second = p.flush();
    release();
    await Promise.all([first, second]);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('does nothing after disable', async () => {
    const p = make();
    count = 1;
    p.disable();
    p.notify();
    await p.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });
});
