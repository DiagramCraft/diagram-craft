import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from '../testSupport/fixtures';
import {
  addDashboardToApplication,
  createApplication,
  removeDashboardFromApplication,
  reorderApplicationDashboards
} from '../../domain/application/applicationOperations';
import { deleteWorkspaceDashboard } from '../../domain/dashboard/dashboardOperations';

runContractSuiteAgainstBothDrivers('ApplicationDatabase', getDb => {
  const newApp = (workspace: string, key: string, sort_order = 0) => ({
    id: randomUUID(),
    workspace,
    key,
    name: key,
    sort_order,
    updated_by: null
  });

  describe('applications', () => {
    it('creates, reads, updates and removes an application', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.application.create({
        ...newApp(workspace, 'strategy'),
        accent_color: '#336699'
      });
      expect(created.accent_color).toBe('#336699');
      expect(created.created_at).toBeInstanceOf(Date);

      expect((await db.application.getByKey(workspace, 'strategy'))?.id).toBe(created.id);

      const updated = await db.application.update(workspace, created.id, {
        name: 'Strategy',
        accent_color: null,
        updated_by: null
      });
      expect(updated?.name).toBe('Strategy');
      expect(updated?.accent_color).toBeNull();

      expect(await db.application.remove(workspace, created.id)).not.toBeNull();
      expect(await db.application.get(workspace, created.id)).toBeNull();
    });

    it('rejects duplicate keys within a workspace and lists by order', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.application.create(newApp(workspace, 'b', 1));
      await db.application.create(newApp(workspace, 'a', 0));
      await expect(db.application.create(newApp(workspace, 'a', 2))).rejects.toThrow();
      expect((await db.application.list(workspace)).map(a => a.key)).toEqual(['a', 'b']);
    });
  });

  describe('application dashboards', () => {
    it('creating an application creates a default Overview dashboard', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const { application, overview } = await createApplication(
        db,
        workspace,
        { key: 'risk', name: 'Risk' },
        null
      );
      expect(overview.name).toBe('Overview');
      expect(overview.application_id).toBe(application.id);
      expect(overview.application_order).toBe(0);
      expect(await db.dashboard.listByApplication(workspace, application.id)).toHaveLength(1);
    });

    it('excludes application dashboards from the workspace dashboard list', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await createApplication(db, workspace, { key: 'risk', name: 'Risk' }, null);
      expect(await db.dashboard.list(workspace)).toEqual([]);
    });

    it('orders dashboards and stores icon and rail label', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const { application, overview } = await createApplication(
        db,
        workspace,
        { key: 'risk', name: 'Risk' },
        null
      );
      const second = await addDashboardToApplication(
        db,
        workspace,
        application.id,
        { name: 'Controls', icon: 'shield', railLabel: 'Controls' },
        null
      );
      expect(second.icon).toBe('shield');
      expect(second.rail_label).toBe('Controls');

      const reordered = await reorderApplicationDashboards(
        db,
        workspace,
        application.id,
        [second.id, overview.id],
        null
      );
      expect(reordered.map(d => d.id)).toEqual([second.id, overview.id]);

      const cleared = await db.dashboard.update(workspace, second.id, {
        icon: null,
        updated_by: null
      });
      expect(cleared?.icon).toBeNull();
      expect(cleared?.rail_label).toBe('Controls');
    });

    it('keeps at least one dashboard in an application', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const { application, overview } = await createApplication(
        db,
        workspace,
        { key: 'risk', name: 'Risk' },
        null
      );
      await expect(
        removeDashboardFromApplication(db, workspace, application.id, overview.id)
      ).rejects.toMatchObject({ status: 400 });
      await expect(deleteWorkspaceDashboard(db, workspace, overview.id)).rejects.toMatchObject({
        status: 400
      });

      const second = await addDashboardToApplication(
        db,
        workspace,
        application.id,
        { name: 'Two' },
        null
      );
      await removeDashboardFromApplication(db, workspace, application.id, second.id);
      expect(await db.dashboard.listByApplication(workspace, application.id)).toHaveLength(1);
    });

    it('cascades dashboard removal when the application is deleted', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const { application, overview } = await createApplication(
        db,
        workspace,
        { key: 'risk', name: 'Risk' },
        null
      );
      await db.application.remove(workspace, application.id);
      expect(await db.dashboard.get(workspace, overview.id)).toBeNull();
    });
  });
});
