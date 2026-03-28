import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestModel } from './test-support/testModel';
import { RuleLayer } from './diagramLayerRule';
import { UnitOfWork } from './unitOfWork';

const { parseAndQuery } = vi.hoisted(() => ({
  parseAndQuery: vi.fn()
}));

vi.mock('embeddable-jq', () => ({
  parseAndQuery
}));

import { searchByElementSearchClauses } from './diagramElementSearch';

describe('diagramElementSearch', () => {
  beforeEach(() => {
    parseAndQuery.mockReset();
  });

  it('maps flat query results to element ids', () => {
    parseAndQuery.mockReturnValue(['node-1', 'node-2']);

    const { diagram } = TestModel.newDiagramWithLayer({
      nodes: [{ id: 'node-1' }, { id: 'node-2' }]
    });

    const [result] = searchByElementSearchClauses(diagram, [
      { id: 'query', type: 'query', query: '.[] | .id' }
    ]);

    expect([...result!]).toEqual(['node-1', 'node-2']);
  });

  it('maps nested single-item query results to element ids', () => {
    parseAndQuery.mockReturnValue([['node-1'], ['node-2']]);

    const { diagram } = TestModel.newDiagramWithLayer({
      nodes: [{ id: 'node-1' }, { id: 'node-2' }]
    });

    const [result] = searchByElementSearchClauses(diagram, [
      { id: 'query', type: 'query', query: '.[] | .id' }
    ]);

    expect([...result!]).toEqual(['node-1', 'node-2']);
  });

  it('treats missing nested props as non-matches', () => {
    const { diagram } = TestModel.newDiagramWithLayer({
      nodes: [{ id: 'node-1' }]
    });

    const [result] = searchByElementSearchClauses(diagram, [
      {
        id: 'props',
        type: 'props',
        path: 'metadata.missing.value',
        relation: 'eq',
        value: 'x'
      }
    ]);

    expect(result).toEqual(new Set());
  });

  it('treats empty any clauses as matching nothing', () => {
    const { diagram } = TestModel.newDiagramWithLayer({
      nodes: [{ id: 'node-1' }]
    });
    const ruleLayer = new RuleLayer('rule-layer', 'Rule Layer', diagram, []);
    UnitOfWork.execute(diagram, uow => diagram.layers.add(ruleLayer, uow));

    UnitOfWork.execute(diagram, uow =>
      ruleLayer.addRule(
        {
          id: 'rule',
          name: 'Empty any rule',
          type: 'node',
          clauses: [{ id: 'any', type: 'any', clauses: [] }],
          actions: [{ id: 'action', type: 'set-props', props: { hidden: true } }]
        },
        uow
      )
    );

    expect(ruleLayer.adjustments()).toEqual(new Map());
  });
});
