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
});
