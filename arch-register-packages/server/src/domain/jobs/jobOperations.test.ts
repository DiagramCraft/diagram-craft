import { describe, expect, it } from 'vitest';
import type { JobServerDbResult } from './jobsDatabase';
import { JOB_SERVER_UNAVAILABLE_AFTER_MS, toApiJobServer } from './jobOperations';

const server = (overrides: Partial<JobServerDbResult> = {}): JobServerDbResult => ({
  id: 'worker-1',
  name: 'Worker one',
  instance_id: 'instance-1',
  status: 'available',
  last_seen_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides
});

describe('toApiJobServer', () => {
  it('reports an available server as unavailable at the two-minute threshold', () => {
    const lastSeen = server().last_seen_at;

    expect(
      toApiJobServer(server(), new Date(lastSeen.getTime() + JOB_SERVER_UNAVAILABLE_AFTER_MS - 1))
        .status
    ).toBe('available');
    expect(
      toApiJobServer(server(), new Date(lastSeen.getTime() + JOB_SERVER_UNAVAILABLE_AFTER_MS))
        .status
    ).toBe('unavailable');
  });

  it('preserves a clean shutdown status even when it was seen recently', () => {
    const stopped = server({ status: 'unavailable' });

    expect(toApiJobServer(stopped, stopped.last_seen_at).status).toBe('unavailable');
  });
});
