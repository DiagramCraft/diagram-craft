import { describe, expect, it } from 'vitest';
import { DocumentProps } from './documentProps';
import { NoOpCRDTRoot } from './collaboration/noopCrdt';
import { TestModel } from './test-support/builder';
import { Backends, standardTestModel } from './collaboration/yjs/collaborationTestUtils';

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
  it('should initialize history with default values', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Verify
    expect(doc1.props.query.history).toEqual([
      ['active-layer', '.elements[]'],
      ['active-layer', '.elements[] | select(.edges | length > 0)']
    ]);
    if (doc2) {
      expect(doc2.props.query.history).toEqual([
        ['active-layer', '.elements[]'],
        ['active-layer', '.elements[] | select(.edges | length > 0)']
      ]);
    }
  });

  it('should add a new entry to history', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Act
    const newEntry: [string, string] = ['new-layer', '.elements[]'];
    doc1.props.query.addHistory(newEntry);

    // Verify
    expect(doc1.props.query.history[0]).toEqual(newEntry);
    if (doc2) {
      expect(doc2.props.query.history[0]).toEqual(newEntry);
    }
  });

  it('should remove duplicate entries in history', () => {
    // Setup
    const { doc1, doc2 } = standardTestModel(backend);

    // Act
    const newEntry: [string, string] = ['active-layer', '.elements[]'];
    doc1.props.query.addHistory(newEntry);

    // Verify
    expect(doc1.props.query.history.length).toBe(2);
    if (doc2) {
      expect(doc2.props.query.history.length).toBe(2);
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
    const newEntry: [string, string] = ['saved-layer', '.elements[]'];
    doc1.props.query.addSaved(newEntry);

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
    const savedQueries: [string, string][] = [
      ['layer-1', '.elements[]'],
      ['layer-2', '.elements[] | select(.type=="node")']
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
    const historyQueries: [string, string][] = [
      ['layer-1', '.elements[]'],
      ['layer-2', '.elements[] | select(.type=="node")']
    ];
    doc1.props.query.setHistory(historyQueries);

    // Verify
    expect(doc1.props.query.history).toEqual(historyQueries.toReversed());
    if (doc2) {
      expect(doc2.props.query.history).toEqual(historyQueries.toReversed());
    }
  });
});
