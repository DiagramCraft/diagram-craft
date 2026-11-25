import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureSchema,
  createFixtureWorkspace
} from '../testSupport/fixtures';

runContractSuiteAgainstBothDrivers('EntityMergeDatabase record locking', getDb => {
  const setup = async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createFixtureSchema(db, workspace);
    const a = await createFixtureEntity(db, workspace, schema);
    const b = await createFixtureEntity(db, workspace, schema);
    return { db, workspace, a, b };
  };

  it('locks existing records and tolerates duplicate ids', async () => {
    const { db, workspace, a, b } = await setup();

    await db.core.transaction(async tx => {
      await tx.entityMerge.lockRecords(workspace, [b.id, a.id, b.id]);
    });
  });

  it('does not deadlock on overlapping lock requests in opposite order', async () => {
    const { db, workspace, a, b } = await setup();

    for (let i = 0; i < 10; i++) {
      await Promise.all([
        db.core.transaction(async tx => {
          await tx.entityMerge.lockRecords(workspace, [a.id, b.id]);
          await new Promise(resolve => setTimeout(resolve, 10));
        }),
        db.core.transaction(async tx => {
          await tx.entityMerge.lockRecords(workspace, [b.id, a.id]);
          await new Promise(resolve => setTimeout(resolve, 10));
        })
      ]);
    }
    expect(true).toBe(true);
  });
});
