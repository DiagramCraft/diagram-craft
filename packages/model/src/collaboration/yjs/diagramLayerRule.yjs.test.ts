import { beforeEach, describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { UnitOfWork } from '../../unitOfWork';
import { Diagram } from '../../diagram';
import { RuleLayer } from '../../diagramLayerRule';
import { TestModel } from '../../test-support/builder';
import { CRDTRoot } from '../crdt';
import { DiagramDocument } from '../../diagramDocument';

describe('YJS RuleLayer', () => {
  setupYJS();

  let diagram1: Diagram;
  let document2: DiagramDocument;
  let ruleLayer1: RuleLayer;
  let ruleLayer2: RuleLayer;

  let crdt1: CRDTRoot;
  let crdt2: CRDTRoot;

  beforeEach(() => {
    const r = createSyncedYJSCRDTs();
    crdt1 = r.doc1;
    crdt2 = r.doc2;

    diagram1 = TestModel.newDiagram(crdt1);
    document2 = TestModel.newDocument(crdt2);

    ruleLayer1 = new RuleLayer('layer1', 'Test Layer', diagram1, [
      { id: 'rule1', name: 'Rule 1', actions: [], type: 'node', clauses: [] },
      { id: 'rule2', name: 'Rule 2', actions: [], type: 'node', clauses: [] }
    ]);
    diagram1.layers.add(ruleLayer1, UnitOfWork.immediate(diagram1));

    ruleLayer2 = document2.topLevelDiagrams[0].layers.visible.at(-1)! as RuleLayer;
  });

  describe('addRule', () => {
    it('should reflect newly added rules via addRule function', () => {
      const newRule = { id: 'rule3', name: 'Rule 3', clauses: [], actions: [] };

      ruleLayer1.addRule({ ...newRule, type: 'node' }, UnitOfWork.immediate(diagram1));

      const rules = ruleLayer1.rules;
      expect(rules).toHaveLength(3);
      expect(rules[2].id).toEqual('rule3');

      expect(ruleLayer2.rules).toHaveLength(3);
      expect(ruleLayer2.rules[2].id).toEqual('rule3');
    });
  });

  describe('removeRule', () => {
    it('should reflect removal of rules via removeRule function', () => {
      ruleLayer1.removeRule(ruleLayer1.rules[1], UnitOfWork.immediate(diagram1));

      const rules = ruleLayer1.rules;
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toEqual('rule1');

      expect(ruleLayer2.rules).toHaveLength(1);
      expect(ruleLayer2.rules[0].id).toEqual('rule1');
    });
  });

  describe('replaceRule', () => {
    it('should replace an existing rule with a new rule via replaceRule function', () => {
      const newRule = { id: 'rule3', name: 'Rule 3', clauses: [], actions: [] };

      ruleLayer1.replaceRule(
        ruleLayer1.rules[0],
        { type: 'node', ...newRule },
        UnitOfWork.immediate(diagram1)
      );

      const rules = ruleLayer1.rules;

      expect(rules).toHaveLength(2);
      expect(rules[0].id).toEqual('rule3');
      expect(rules[1].id).toEqual('rule2');

      expect(ruleLayer2.rules).toHaveLength(2);
      expect(ruleLayer2.rules[0].id).toEqual('rule3');
      expect(ruleLayer2.rules[1].id).toEqual('rule2');
    });
  });
});
