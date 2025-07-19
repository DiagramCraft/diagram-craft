import { describe, expect, it, vi } from 'vitest';
import { DiagramDocumentData } from './diagramDocumentData';
import { NoOpCRDTRoot } from './collaboration/noopCrdt';
import { TestModel } from './test-support/builder';
import { DefaultDataProvider } from './dataProviderDefault';
import { Backends, standardTestModel } from './collaboration/yjs/collaborationTestUtils';
import { UrlDataProvider } from './dataProviderUrl';

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
      docData1.setProvider(provider);

      // Verify
      expect((docData1.provider as UrlDataProvider).dataUrl).toBe(dataUrl);
      expect((docData1.provider as UrlDataProvider).schemaUrl).toBe(schemaUrl);
      if (docData2) {
        expect((docData2.provider as UrlDataProvider).dataUrl).toBe(dataUrl);
        expect((docData2.provider as UrlDataProvider).schemaUrl).toBe(schemaUrl);
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

      docData1.setProvider(provider);

      // Acti
      docData1.setProvider(undefined);

      // Verify
      expect(docData1.provider).toBeUndefined();
      if (docData2) expect(docData2.provider).toBeUndefined();
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
      docData1.setProvider(provider);

      // Verify
      expect(onChange1).toHaveBeenCalledTimes(1);
      if (docData2) expect(onChange2).toHaveBeenCalledTimes(1);
    });

    it('does not emit change event when initial is true', () => {
      const docData = new DiagramDocumentData(new NoOpCRDTRoot(), TestModel.newDocument());
      const provider = new DefaultDataProvider('{}');
      const onChange = vi.fn();

      docData.on('change', onChange);
      docData.setProvider(provider, true);

      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
