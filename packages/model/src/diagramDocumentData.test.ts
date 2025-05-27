import { describe, expect, it, vi } from 'vitest';
import { DiagramDocumentData } from './diagramDocumentData';
import { NoOpCRDTRoot } from './collaboration/noopCrdt';
import { TestModel } from './test-support/builder';
import { DefaultDataProvider } from './dataProviderDefault';

describe('DiagramDocumentData', () => {
  describe('setProvider', () => {
    it('sets a new provider and updates CRDT', () => {
      const docData = new DiagramDocumentData(new NoOpCRDTRoot(), TestModel.newDocument());
      const provider = new DefaultDataProvider('{}');

      docData.setProvider(provider);

      expect(docData.provider).toBe(provider);
    });

    it('removes the provider and clears CRDT value', () => {
      const docData = new DiagramDocumentData(new NoOpCRDTRoot(), TestModel.newDocument());
      const provider = new DefaultDataProvider('{}');

      docData.setProvider(provider);

      docData.setProvider(undefined);

      expect(docData.provider).toBeUndefined();
    });

    it('calls listeners when provider changes', () => {
      const docData = new DiagramDocumentData(new NoOpCRDTRoot(), TestModel.newDocument());
      const provider = new DefaultDataProvider('{}');
      const onChange = vi.fn();

      docData.on('change', onChange);

      docData.setProvider(provider);

      expect(onChange).toHaveBeenCalledTimes(1);
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
