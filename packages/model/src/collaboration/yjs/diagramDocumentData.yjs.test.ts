import { describe, expect, it, vi } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { DiagramDocumentData } from '../../diagramDocumentData';
import { TestModel } from '../../test-support/builder';
import { UrlDataProvider } from '../../dataProviderUrl';
import { DefaultDataProvider } from '../../dataProviderDefault';

describe('DiagramDocumentData', () => {
  setupYJS();

  describe('setProvider', () => {
    it('sets a new provider and updates CRDT', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const instance1 = new DiagramDocumentData(doc1, TestModel.newDocument());
      const instance2 = new DiagramDocumentData(doc2, TestModel.newDocument());

      const dataUrl = 'https://google.com';
      const schemaUrl = 'https://yahoo.com';
      const provider = new UrlDataProvider(
        `{ "dataUrl": "${dataUrl}", "schemaUrl": "${schemaUrl}" }`
      );
      instance1.setProvider(provider);

      expect((instance1.provider as UrlDataProvider).dataUrl).toBe(dataUrl);
      expect((instance1.provider as UrlDataProvider).schemaUrl).toBe(schemaUrl);
      expect((instance2.provider as UrlDataProvider).dataUrl).toBe(dataUrl);
      expect((instance2.provider as UrlDataProvider).schemaUrl).toBe(schemaUrl);
    });

    it('removes the provider and clears CRDT value', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const instance1 = new DiagramDocumentData(doc1, TestModel.newDocument());
      const instance2 = new DiagramDocumentData(doc2, TestModel.newDocument());

      const provider = new DefaultDataProvider('{}');

      instance1.setProvider(provider);

      instance1.setProvider(undefined);

      expect(instance1.provider).toBeUndefined();
      expect(instance2.provider).toBeUndefined();
    });

    it('calls listeners when provider changes', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const instance1 = new DiagramDocumentData(doc1, TestModel.newDocument());
      const instance2 = new DiagramDocumentData(doc2, TestModel.newDocument());

      const provider = new DefaultDataProvider('{}');
      const onChange1 = vi.fn();
      instance1.on('change', onChange1);

      const onChange2 = vi.fn();
      instance2.on('change', onChange2);

      instance1.setProvider(provider);

      expect(onChange1).toHaveBeenCalledTimes(1);
      expect(onChange2).toHaveBeenCalledTimes(1);
    });
  });
});
