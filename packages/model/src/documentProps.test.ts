import { describe, expect, it } from 'vitest';
import { DocumentProps, type QueryEntry } from './documentProps';
import { NoOpCRDTRoot } from '@diagram-craft/collaboration/noopCrdt';
import { TestModel } from './test-support/testModel';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';
import { standardTestModel } from './test-support/collaborationModelTestUtils';

describe('DocumentProps', () => {
  it('should initialize with a query object', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());

    expect(documentProps.query).toBeDefined();
  });
});

describe.each(Backends.all())('RecentStencils [%s]', (_name, backend) => {
  it('should initialize with an empty list', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const recentStencils = documentProps.recentStencils;

    expect(recentStencils.stencils).toEqual([]);
  });

  it('should register a new stencil', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Act
    const stencilId = 'stencil-1';
    doc1.props.recentStencils.register(stencilId);

    // Verify
    expect(doc1.props.recentStencils.stencils).toEqual([stencilId]);
    if (doc2) {
      expect(doc2.props.recentStencils.stencils).toEqual([stencilId]);
    }
  });

  it('should not register duplicate stencils', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const recentStencils = documentProps.recentStencils;

    const stencilId = 'stencil-1';
    recentStencils.register(stencilId);
    recentStencils.register(stencilId);

    expect(recentStencils.stencils).toEqual([stencilId]);
  });

  it('should initialize stencils using set method', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Act
    const initialStencils = ['s-3', 's-2', 's-1'];
    doc1.props.recentStencils.set(initialStencils);

    // Verify
    expect(doc1.props.recentStencils.stencils).toEqual(initialStencils.toReversed());
    if (doc2) {
      expect(doc2.props.recentStencils.stencils).toEqual(initialStencils.toReversed());
    }
  });
});

describe.each(Backends.all())('Query [%s]', (_name, backend) => {
  it('should add a new entry to history', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Act
    const newEntry: QueryEntry = {
      type: 'djql',
      scope: 'new-layer',
      label: '.elements[]',
      value: '.elements[]'
    };
    doc1.props.query.addHistory(newEntry.type, newEntry.label, newEntry.scope, newEntry.value);

    // Verify
    expect(doc1.props.query.history[0]).toEqual(newEntry);
    if (doc2) {
      expect(doc2.props.query.history[0]).toEqual(newEntry);
    }
  });

  it('should initialize saved with an empty array', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const query = documentProps.query;

    expect(query.saved).toEqual([]);
  });

  it('should add a new entry to saved', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Act
    const newEntry: QueryEntry = {
      scope: 'saved-layer',
      type: 'djql',
      value: '.elements[]',
      label: '.elements[]'
    };
    doc1.props.query.addSaved(newEntry.type, newEntry.label, newEntry.scope, newEntry.value);

    // Verify
    expect(doc1.props.query.saved[0]).toEqual(newEntry);
    if (doc2) {
      expect(doc2.props.query.saved[0]).toEqual(newEntry);
    }
  });

  it('should set saved queries with new array', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Act
    const savedQueries: QueryEntry[] = [
      { scope: 'layer-1', type: 'djql', value: '.elements[]', label: 'a' },
      { scope: 'layer-2', type: 'djql', value: '.elements[] | select(.type=="node")', label: 'b' }
    ];
    doc1.props.query.setSaved(savedQueries);

    // Verify
    expect(doc1.props.query.saved).toEqual(savedQueries);
    if (doc2) {
      expect(doc2.props.query.saved).toEqual(savedQueries);
    }
  });

  it('should set history with new array', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Act
    const historyQueries: QueryEntry[] = [
      { scope: 'layer-1', type: 'djql', value: '.elements[]', label: 'a' },
      { scope: 'layer-2', type: 'djql', value: '.elements[] | select(.type=="node")', label: 'b' }
    ];
    doc1.props.query.setHistory(historyQueries);

    // Verify
    expect(doc1.props.query.history).toEqual(historyQueries.toReversed());
    if (doc2) {
      expect(doc2.props.query.history).toEqual(historyQueries.toReversed());
    }
  });
});
