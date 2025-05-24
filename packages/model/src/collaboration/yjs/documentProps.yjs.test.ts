import { describe, expect, it } from 'vitest';
import { createSyncedDocs, setupYJS } from './yjsTest';

describe('YJS Query', () => {
  setupYJS();

  it('should initialize history with default values', () => {
    const { document1, document2 } = createSyncedDocs();

    expect(document1.props.query.history).toEqual([
      ['active-layer', '.elements[]'],
      ['active-layer', '.elements[] | select(.edges | length > 0)']
    ]);
    expect(document2.props.query.history).toEqual([
      ['active-layer', '.elements[]'],
      ['active-layer', '.elements[] | select(.edges | length > 0)']
    ]);
  });

  it('should add a new entry to history', () => {
    const { document1, document2 } = createSyncedDocs();

    const newEntry: [string, string] = ['new-layer', '.elements[]'];
    document1.props.query.addHistory(newEntry);

    expect(document2.props.query.history[0]).toEqual(newEntry);
  });

  it('should remove duplicate entries in history', () => {
    const { document1, document2 } = createSyncedDocs();

    const newEntry: [string, string] = ['active-layer', '.elements[]'];
    document1.props.query.addHistory(newEntry);

    expect(document1.props.query.history.length).toBe(2);
    expect(document2.props.query.history.length).toBe(2);
  });

  it('should add a new entry to saved', () => {
    const { document1, document2 } = createSyncedDocs();

    const newEntry: [string, string] = ['saved-layer', '.elements[]'];
    document1.props.query.addSaved(newEntry);

    expect(document1.props.query.saved).toEqual([newEntry]);
    expect(document2.props.query.saved).toEqual([newEntry]);
  });

  it('should set saved queries with new array', () => {
    const { document1, document2 } = createSyncedDocs();
    const query = document1.props.query;

    const savedQueries: [string, string][] = [
      ['layer-1', '.elements[]'],
      ['layer-2', '.elements[] | select(.type=="node")']
    ];
    query.setSaved(savedQueries);

    expect(query.saved).toEqual(savedQueries);
    expect(document2.props.query.saved).toEqual(savedQueries);
  });

  it('should set history with new array', () => {
    const { document1, document2 } = createSyncedDocs();
    const query = document1.props.query;

    const historyQueries: [string, string][] = [
      ['layer-1', '.elements[]'],
      ['layer-2', '.elements[] | select(.type=="node")']
    ];
    query.setHistory(historyQueries);

    expect(query.history).toEqual(historyQueries.toReversed());
    expect(document2.props.query.history).toEqual(historyQueries.toReversed());
  });
});

describe('YJS RecentStencils', () => {
  setupYJS();

  describe('register', () => {
    it('should register a new stencil', () => {
      const { document1, document2 } = createSyncedDocs();
      const recentStencils = document1.props.recentStencils;
      const stencilId = 'stencil-1';
      recentStencils.register(stencilId);
      expect(recentStencils.stencils).toEqual([stencilId]);
      expect(document2.props.recentStencils.stencils).toEqual([stencilId]);
    });
  });

  describe('set', () => {
    it('should initialize stencils using set method', () => {
      const { document1, document2 } = createSyncedDocs();
      const recentStencils = document1.props.recentStencils;

      const initialStencils = ['s-3', 's-2', 's-1'];
      recentStencils.set(initialStencils);
      expect(recentStencils.stencils).toEqual(initialStencils.toReversed());
      expect(document2.props.recentStencils.stencils).toEqual(initialStencils.toReversed());
    });
  });
});
