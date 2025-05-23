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
});
