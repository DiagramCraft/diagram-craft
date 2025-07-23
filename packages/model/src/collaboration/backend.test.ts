/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { NoOpCollaborationBackend } from './backend';

describe('NoOpCollaborationBackend', () => {
  it('should have a default awareness instance', () => {
    const backend = new NoOpCollaborationBackend();
    expect(backend.awareness).toBeDefined();
  });

  it('should have isMultiUser set to false', () => {
    const backend = new NoOpCollaborationBackend();
    expect(backend.isMultiUser).toBe(false);
  });

  it('connect method should immediately invoke the callback with "complete" status', async () => {
    const backend = new NoOpCollaborationBackend();
    const callback = vi.fn();
    await backend.connect('test-url', {} as any, callback);
    expect(callback).toHaveBeenCalledWith('complete', {});
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('disconnect method should immediately invoke the callback with "complete" status', () => {
    const backend = new NoOpCollaborationBackend();
    const callback = vi.fn();
    backend.disconnect(callback);
    expect(callback).toHaveBeenCalledWith('complete', {});
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
