import { describe, expect, it, vi } from 'vitest';
import { DiagramDocumentData } from './diagramDocumentData';
import { NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { TestModel } from './test-support/testModel';
import { DefaultDataProvider } from './data-providers/dataProviderDefault';
import { standardTestModel } from './test-support/collaborationModelTestUtils';
import { UrlDataProvider } from './data-providers/dataProviderUrl';
import { newid } from '@diagram-craft/utils/id';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.each(Backends.all())('DiagramDocumentData [%s]', (_name, backend) => {
  describe('setProvider', () => {
    it('sets a new provider and updates CRDT', () => {
      // Setup
      const { root1, root2 } = standardTestModel(backend);

      const docData1 = new DiagramDocumentData(root1, TestModel.newDocument(root1));
      const docData2 = root2
        ? new DiagramDocumentData(root2, TestModel.newDocument(root2))
        : undefined;

      // Act
      const dataUrl = 'https://google.com';
      const schemaUrl = 'https://yahoo.com';
      const provider = new UrlDataProvider(
        `{ "dataUrl": "${dataUrl}", "schemaUrl": "${schemaUrl}" }`,
        false
      );
      docData1.setProviders([provider]);

      // Verify
      expect((docData1.providers[1] as UrlDataProvider).dataUrl).toBe(dataUrl);
      expect((docData1.providers[1] as UrlDataProvider).schemaUrl).toBe(schemaUrl);
      if (docData2) {
        expect((docData2.providers[1] as UrlDataProvider).dataUrl).toBe(dataUrl);
        expect((docData2.providers[1] as UrlDataProvider).schemaUrl).toBe(schemaUrl);
      }
    });

    it('removes the provider and clears CRDT value', () => {
      // Setup
      const { root1, root2 } = standardTestModel(backend);

      const docData1 = new DiagramDocumentData(root1, TestModel.newDocument(root1));
      const docData2 = root2
        ? new DiagramDocumentData(root2, TestModel.newDocument(root2))
        : undefined;

      const provider = new DefaultDataProvider('{}');

      docData1.setProviders([provider]);

      // Acti
      docData1.setProviders([]);

      // Verify
      expect(docData1.providers[1]).toBeUndefined();
      if (docData2) expect(docData2.providers[1]).toBeUndefined();
    });

    it('calls listeners when provider changes', () => {
      // Setup
      const { root1, root2 } = standardTestModel(backend);

      const docData1 = new DiagramDocumentData(root1, TestModel.newDocument(root1));
      const docData2 = root2
        ? new DiagramDocumentData(root2, TestModel.newDocument(root2))
        : undefined;

      const provider = new DefaultDataProvider('{}');

      const onChange1 = vi.fn();
      docData1.on('change', onChange1);

      const onChange2 = vi.fn();
      docData2?.on('change', onChange2);

      // Act
      docData1.setProviders([provider]);

      // Verify
      expect(onChange1).toHaveBeenCalledTimes(1);
      if (docData2) expect(onChange2).toHaveBeenCalledTimes(1);
    });

    it('does not emit change event when initial is true', () => {
      const docData = new DiagramDocumentData(new NoOpCRDTRoot(), TestModel.newDocument());
      const provider = new DefaultDataProvider('{}');
      const onChange = vi.fn();

      docData.on('change', onChange);
      docData.setProviders([provider], true);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('setProviderPolicy', () => {
    const makePolicyProvider = () =>
      new UrlDataProvider(
        `{ "dataUrl": "https://example.com/data", "schemaUrl": "https://example.com/schema" }`,
        false
      );

    it('applies the policy on construction without writing the CRDT provider key', () => {
      // Use a fresh root directly (not standardTestModel, which already constructs
      // an unrelated document/diagram on root1, writing the CRDT provider key as a
      // side effect before this test's document is even created).
      const [root1] = backend.syncedDocs();

      const policyProvider = makePolicyProvider();
      const docData = TestModel.newDocument(root1, {
        providers: () => [policyProvider],
        includeDefaultProvider: false
      }).data;

      expect(docData.providers).toHaveLength(1);
      expect(docData.providers[0]).toBe(policyProvider);

      // Constructor must not fall through to the unconditional setProviders([])
      // that would unshift a DefaultDataProvider and write it into the CRDT.
      expect(root1.getMap('documentData').get('provider')).toBeUndefined();
    });

    it('does not apply a remote provider write while a policy is active', () => {
      const { root1, root2 } = standardTestModel(backend);
      if (!root2) return;

      const policyProvider = makePolicyProvider();
      const docData1 = TestModel.newDocument(root1, {
        providers: () => [policyProvider],
        includeDefaultProvider: false
      }).data;
      const docData2 = TestModel.newDocument(root2).data;

      // docData2 has no policy, so its own write goes through and reaches the CRDT.
      const remoteProvider = new DefaultDataProvider('{}');
      docData2.setProviders([remoteProvider]);

      // docData1 must be unaffected by the remote write — it re-derives from its policy.
      expect(docData1.providers).toHaveLength(1);
      expect(docData1.providers[0]).toBe(policyProvider);

      // docData2, with no policy, does update normally.
      expect(docData2.providers[0]).toBeInstanceOf(DefaultDataProvider);
    });

    it('suppresses a DefaultDataProvider already present in the CRDT when a policy is applied', () => {
      const { root1, root2 } = standardTestModel(backend);
      if (!root2) return;

      // A first client (no policy) writes a DefaultDataProvider into the CRDT.
      const docData1 = TestModel.newDocument(root1).data;
      docData1.setProviders([]);
      expect(root1.getMap('documentData').get('provider')).toBeDefined();

      // A second client applies a policy on top of that existing CRDT state.
      const policyProvider = makePolicyProvider();
      const docData2 = TestModel.newDocument(root2, {
        providers: () => [policyProvider],
        includeDefaultProvider: false
      }).data;

      expect(docData2.providers).toHaveLength(1);
      expect(docData2.providers[0]).toBe(policyProvider);
    });

    it('includeDefaultProvider: false skips the DefaultDataProvider unshift', () => {
      const { root1 } = standardTestModel(backend);

      const policyProvider = makePolicyProvider();
      const docDataWithout = TestModel.newDocument(root1, {
        providers: () => [policyProvider],
        includeDefaultProvider: false
      }).data;
      expect(docDataWithout.providers).toHaveLength(1);
      expect(docDataWithout.providers.some(p => p instanceof DefaultDataProvider)).toBe(false);

      const { root1: root1b } = standardTestModel(backend);
      const policyProvider2 = makePolicyProvider();
      const docDataWith = TestModel.newDocument(root1b, {
        providers: () => [policyProvider2]
      }).data;
      expect(docDataWith.providers).toHaveLength(2);
      expect(docDataWith.providers[0]).toBeInstanceOf(DefaultDataProvider);
      expect(docDataWith.providers[1]).toBe(policyProvider2);
    });
  });
});

describe.each(Backends.all())('DataManager [%s]', (_name, backend) => {
  describe('Document Overrides', () => {
    it('stores add overrides in CRDT when useDocumentOverrides is true', () => {
      const { root1, root2 } = standardTestModel(backend);
      const docData1 = new DiagramDocumentData(root1, TestModel.newDocument(root1));
      const docData2 = root2
        ? new DiagramDocumentData(root2, TestModel.newDocument(root2))
        : undefined;

      // Create a schema with useDocumentOverrides enabled
      const schemaId = 'test-schema';
      docData1._schemas.add({
        id: schemaId,
        name: 'Test Schema',
        providerId: 'default',
        fields: [{ id: 'name', name: 'Name', type: 'text' }]
      });
      docData1.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Add data - should store as override
      const testData = { _uid: newid(), name: 'Test Item' };
      docData1.db.addData(docData1._schemas.get(schemaId), testData);

      // Verify override is stored in CRDT
      const result1 = docData1.db.getOverrideStatusForItem(schemaId, testData._uid);
      expect(result1.status).toBe('modified');
      expect(result1.override).toBeDefined();
      expect(result1.override?.type).toBe('add');
      expect(result1.override?.data).toEqual(testData);

      // Verify it syncs to other instance
      if (docData2) {
        const result2 = docData2.db.getOverrideStatusForItem(schemaId, testData._uid);
        expect(result2.status).toBe('modified');
        expect(result2.override).toBeDefined();
        expect(result2.override?.type).toBe('add');
        expect(result2.override?.data).toEqual(testData);
      }
    });

    it('stores update overrides in CRDT when useDocumentOverrides is true', () => {
      const { root1, root2 } = standardTestModel(backend);
      const docData1 = new DiagramDocumentData(root1, TestModel.newDocument(root1));
      const docData2 = root2
        ? new DiagramDocumentData(root2, TestModel.newDocument(root2))
        : undefined;

      const schemaId = 'test-schema';
      const testData = { _uid: newid(), name: 'Updated Item' };
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: [{ ...testData, _schemaId: schemaId, name: 'Original Item' }]
        })
      );
      provider.setCRDT(root1);
      docData1.setProviders([provider]);
      docData1.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      docData1.db.updateData(docData1.db.getSchema(schemaId), testData);

      const result1 = docData1.db.getOverrideStatusForItem(schemaId, testData._uid);
      expect(result1.status).toBe('modified');
      expect(result1.override?.type).toBe('update');
      expect(result1.override?.data).toEqual(testData);

      if (docData2) {
        const result2 = docData2.db.getOverrideStatusForItem(schemaId, testData._uid);
        expect(result2.status).toBe('modified');
        expect(result2.override?.type).toBe('update');
      }
    });

    it('stores delete overrides in CRDT when useDocumentOverrides is true', () => {
      const { root1, root2 } = standardTestModel(backend);
      const docData1 = new DiagramDocumentData(root1, TestModel.newDocument(root1));
      const docData2 = root2
        ? new DiagramDocumentData(root2, TestModel.newDocument(root2))
        : undefined;

      const schemaId = 'test-schema';
      const testData = { _uid: newid(), name: 'To Delete' };
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: [{ ...testData, _schemaId: schemaId }]
        })
      );
      provider.setCRDT(root1);
      docData1.setProviders([provider]);
      docData1.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      docData1.db.deleteData(docData1.db.getSchema(schemaId), testData);

      const result1 = docData1.db.getOverrideStatusForItem(schemaId, testData._uid);
      expect(result1.status).toBe('modified');
      expect(result1.override?.type).toBe('delete');
      expect(result1.override?.data).toEqual(testData);

      if (docData2) {
        const result2 = docData2.db.getOverrideStatusForItem(schemaId, testData._uid);
        expect(result2.status).toBe('modified');
        expect(result2.override?.type).toBe('delete');
      }
    });

    it('sends to provider when useDocumentOverrides is false', async () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: []
        })
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: false });

      const testData = { _uid: newid(), name: 'Test Item' };
      await docData.db.addData(docData.db.getSchema(schemaId), testData);

      // Should NOT create an override
      const result = docData.db.getOverrideStatusForItem(schemaId, testData._uid);
      expect(result.status).toBe('unmodified');
      expect(result.override).toBeUndefined();

      // Should be in the provider
      const providerData = docData.db.getData(docData.db.getSchema(schemaId));
      expect(providerData).toHaveLength(1);
      expect(providerData[0]?._uid).toBe(testData._uid);
    });

    it('merges overrides with provider data when querying', () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const existingDataUid = newid();
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: [{ _uid: existingDataUid, _schemaId: schemaId, name: 'Provider Item' }]
        })
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Add override
      const overrideData = { _uid: newid(), name: 'Override Item' };
      docData.db.addData(docData.db.getSchema(schemaId), overrideData);

      // Query should return both provider data and override
      const result = docData.db.getData(docData.db.getSchema(schemaId));
      expect(result).toHaveLength(2);
      expect(result.map(d => d._uid)).toContain(existingDataUid);
      expect(result.map(d => d._uid)).toContain(overrideData._uid);
    });

    it('override update replaces provider data in query results', () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const dataUid = newid();
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: [{ _uid: dataUid, _schemaId: schemaId, name: 'Original' }]
        })
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Update override
      const updatedData = { _uid: dataUid, name: 'Updated' };
      docData.db.updateData(docData.db.getSchema(schemaId), updatedData);

      // Query should return updated data
      const result = docData.db.getData(docData.db.getSchema(schemaId));
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Updated');
    });

    it('override delete removes provider data from query results', () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const dataUid = newid();
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: [{ _uid: dataUid, _schemaId: schemaId, name: 'To Delete' }]
        })
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Delete override
      const deleteData = { _uid: dataUid, name: 'To Delete' };
      docData.db.deleteData(docData.db.getSchema(schemaId), deleteData);

      // Query should not return deleted data
      const result = docData.db.getData(docData.db.getSchema(schemaId));
      expect(result).toHaveLength(0);
    });

    it('applyOverrides sends add operations to provider', async () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: []
        })
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Add override
      const testData = { _uid: newid(), name: 'Test Item' };
      await docData.db.addData(docData.db.getSchema(schemaId), testData);

      // Apply overrides
      await docData.db.applyOverrides([{ schemaId, uid: testData._uid }]);

      // Verify override is removed
      const result = docData.db.getOverrideStatusForItem(schemaId, testData._uid);
      expect(result.status).toBe('unmodified');
      expect(result.override).toBeUndefined();

      // Verify data is in provider
      const providerData = docData.db.getData(docData.db.getSchema(schemaId));
      expect(providerData).toHaveLength(1);
      expect(providerData[0]?._uid).toBe(testData._uid);
    });

    it('applyOverrides sends update operations to provider', async () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const dataUid = newid();
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: [{ _uid: dataUid, _schemaId: schemaId, name: 'Original' }]
        })
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Update override
      const updatedData = { _uid: dataUid, name: 'Updated' };
      await docData.db.updateData(docData.db.getSchema(schemaId), updatedData);

      // Apply overrides
      await docData.db.applyOverrides([{ schemaId, uid: dataUid }]);

      // Verify override is removed
      const resultAfterApply = docData.db.getOverrideStatusForItem(schemaId, dataUid);
      expect(resultAfterApply.status).toBe('unmodified');
      expect(resultAfterApply.override).toBeUndefined();

      // Verify data is updated in provider (after disabling overrides to read actual provider data)
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: false });
      const providerData = docData.db.getData(docData.db.getSchema(schemaId));
      expect(providerData[0]?.name).toBe('Updated');
    });

    it('applyOverrides sends delete operations to provider', async () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const dataUid = newid();
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: [{ _uid: dataUid, _schemaId: schemaId, name: 'To Delete' }]
        })
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Delete override
      const deleteData = { _uid: dataUid, name: 'To Delete' };
      await docData.db.deleteData(docData.db.getSchema(schemaId), deleteData);

      // Apply overrides
      await docData.db.applyOverrides([{ schemaId, uid: dataUid }]);

      // Verify override is removed
      const resultAfterApply = docData.db.getOverrideStatusForItem(schemaId, dataUid);
      expect(resultAfterApply.status).toBe('unmodified');
      expect(resultAfterApply.override).toBeUndefined();

      // Verify data is deleted from provider
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: false });
      const providerData = docData.db.getData(docData.db.getSchema(schemaId));
      expect(providerData).toHaveLength(0);
    });

    it('clearOverride removes a specific override', () => {
      const { root1, root2 } = standardTestModel(backend);
      const docData1 = new DiagramDocumentData(root1, TestModel.newDocument(root1));
      const docData2 = root2
        ? new DiagramDocumentData(root2, TestModel.newDocument(root2))
        : undefined;

      const schemaId = 'test-schema';
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: []
        })
      );
      docData1.setProviders([provider]);
      docData1.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      // Add multiple overrides
      const data1 = { _uid: newid(), name: 'Item 1' };
      const data2 = { _uid: newid(), name: 'Item 2' };
      docData1.db.addData(docData1.db.getSchema(schemaId), data1);
      docData1.db.addData(docData1.db.getSchema(schemaId), data2);

      // Verify both exist
      const result1Before = docData1.db.getOverrideStatusForItem(schemaId, data1._uid);
      expect(result1Before.status).toBe('modified');
      const result2Before = docData1.db.getOverrideStatusForItem(schemaId, data2._uid);
      expect(result2Before.status).toBe('modified');

      // Clear only the first override
      docData1.db.clearOverride(schemaId, data1._uid);

      // Verify first is cleared, second remains
      const result1After = docData1.db.getOverrideStatusForItem(schemaId, data1._uid);
      expect(result1After.status).toBe('unmodified');
      expect(result1After.override).toBeUndefined();

      const result2After = docData1.db.getOverrideStatusForItem(schemaId, data2._uid);
      expect(result2After.status).toBe('modified');
      expect(result2After.override).toBeDefined();

      // If syncing, verify it syncs to other instance
      if (docData2) {
        const result1Sync = docData2.db.getOverrideStatusForItem(schemaId, data1._uid);
        expect(result1Sync.status).toBe('unmodified');

        const result2Sync = docData2.db.getOverrideStatusForItem(schemaId, data2._uid);
        expect(result2Sync.status).toBe('modified');
      }
    });

    it('clearOverride is safe to call on non-existent overrides', () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: []
        })
      );
      docData.setProviders([provider]);

      // Should not throw when clearing non-existent override
      expect(() => {
        docData.db.clearOverride(schemaId, 'non-existent-uid');
      }).not.toThrow();

      // Should not throw when schema has no overrides at all
      expect(() => {
        docData.db.clearOverride('non-existent-schema', 'non-existent-uid');
      }).not.toThrow();
    });

    it('applyOverrides throws error if provider is not mutable', async () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const provider = new UrlDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: '', // UrlDataProvider has empty id by default
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          dataUrl: 'https://example.com',
          schemaUrl: 'https://example.com'
        }),
        false
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      const testData = { _uid: newid(), name: 'Test Item' };
      const schema = docData.db.getSchema(schemaId);
      await docData.db.addData(schema, testData);

      await expect(docData.db.applyOverrides([{ schemaId, uid: testData._uid }])).rejects.toThrow(
        /not mutable/
      );
    });

    it.skip('emits events when overrides are added', async () => {
      const { root1 } = standardTestModel(backend);
      const docData = new DiagramDocumentData(root1, TestModel.newDocument(root1));

      const schemaId = 'test-schema';
      const provider = new DefaultDataProvider(
        JSON.stringify({
          schemas: [
            {
              id: schemaId,
              name: 'Test Schema',
              providerId: 'default',
              fields: [{ id: 'name', name: 'Name', type: 'text' }]
            }
          ],
          data: []
        })
      );
      docData.setProviders([provider]);
      docData.setSchemaMetadata(schemaId, { useDocumentOverrides: true });

      const addListener = vi.fn();
      const updateListener = vi.fn();
      const deleteListener = vi.fn();

      // Attach listeners AFTER setProviders to avoid them being cleared by rebuildDataManager
      docData.db.on('addData', addListener);
      docData.db.on('updateData', updateListener);
      docData.db.on('deleteData', deleteListener);

      const testData = { _uid: newid(), name: 'Test Item' };
      const schema = docData.db.getSchema(schemaId);
      const dbInstance = docData.db;
      await dbInstance.addData(schema, testData);

      expect(addListener).toHaveBeenCalledWith({ data: [testData] });
      expect(updateListener).not.toHaveBeenCalled();
      expect(deleteListener).not.toHaveBeenCalled();
    });
  });
});
