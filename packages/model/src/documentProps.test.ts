import { describe, expect, it } from 'vitest';
import { DocumentProps } from './documentProps';
import { NoOpCRDTRoot } from './collaboration/noopCrdt';
import { TestModel } from './test-support/builder';

describe('DocumentProps', () => {
  it('should initialize with a query object', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());

    expect(documentProps.query).toBeDefined();
  });
});

describe('RecentStencils', () => {
  it('should initialize with an empty list', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const recentStencils = documentProps.recentStencils;

    expect(recentStencils.stencils).toEqual([]);
  });

  it('should register a new stencil', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const recentStencils = documentProps.recentStencils;

    const stencilId = 'stencil-1';
    recentStencils.register(stencilId);

    expect(recentStencils.stencils).toEqual([stencilId]);
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
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const recentStencils = documentProps.recentStencils;

    const initialStencils = ['s-3', 's-2', 's-1'];
    recentStencils.set(initialStencils);

    expect(recentStencils.stencils).toEqual(initialStencils.toReversed());
  });
});

describe('Query', () => {
  it('should initialize history with default values', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const query = documentProps.query;

    expect(query.history).toEqual([
      ['active-layer', '.elements[]'],
      ['active-layer', '.elements[] | select(.edges | length > 0)']
    ]);
  });

  it('should add a new entry to history', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const query = documentProps.query;

    const newEntry: [string, string] = ['new-layer', '.elements[]'];
    query.addHistory(newEntry);

    expect(query.history[0]).toEqual(newEntry);
  });

  it('should remove duplicate entries in history', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const query = documentProps.query;

    const newEntry: [string, string] = ['active-layer', '.elements[]'];
    query.addHistory(newEntry);

    expect(query.history.length).toBe(2);
  });

  it('should initialize saved with an empty array', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const query = documentProps.query;

    expect(query.saved).toEqual([]);
  });

  it('should add a new entry to saved', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const query = documentProps.query;

    const newEntry: [string, string] = ['saved-layer', '.elements[]'];
    query.addSaved(newEntry);

    expect(query.saved[0]).toEqual(newEntry);
  });

  it('should set saved queries with new array', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const query = documentProps.query;

    const savedQueries: [string, string][] = [
      ['layer-1', '.elements[]'],
      ['layer-2', '.elements[] | select(.type=="node")']
    ];
    query.setSaved(savedQueries);

    expect(query.saved).toEqual(savedQueries);
  });

  it('should set history with new array', () => {
    const documentProps = new DocumentProps(new NoOpCRDTRoot(), TestModel.newDocument());
    const query = documentProps.query;

    const historyQueries: [string, string][] = [
      ['layer-1', '.elements[]'],
      ['layer-2', '.elements[] | select(.type=="node")']
    ];
    query.setHistory(historyQueries);

    expect(query.history).toEqual(historyQueries.toReversed());
  });
});
