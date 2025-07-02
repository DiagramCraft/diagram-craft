import { beforeEach, describe, expect, it } from 'vitest';
import { RuleLayer } from './diagramLayerRule';
import { Diagram } from './diagram';
import { UnitOfWork } from './unitOfWork';
import { TestModel } from './test-support/builder';

describe('RuleLayer', () => {
  let diagram: Diagram;
  let ruleLayer: RuleLayer;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram, [
      { id: 'rule1', name: 'Rule 1', actions: [], type: 'node', clauses: [] },
      { id: 'rule2', name: 'Rule 2', actions: [], type: 'node', clauses: [] }
    ]);
  });

  describe('rules', () => {
    it('should return all the rules added to the layer', () => {
      const rules = ruleLayer.rules;

      expect(rules).toHaveLength(2);
      expect(rules[0].id).toEqual('rule1');
      expect(rules[1].id).toEqual('rule2');
    });
  });

  describe('addRule', () => {
    it('should reflect newly added rules via addRule function', () => {
      const newRule = { id: 'rule3', name: 'Rule 3', clauses: [], actions: [] };

      ruleLayer.addRule({ ...newRule, type: 'node' }, UnitOfWork.immediate(diagram));

      const rules = ruleLayer.rules;
      expect(rules).toHaveLength(3);
      expect(rules[2].id).toEqual('rule3');
    });
  });

  describe('removeRule', () => {
    it('should reflect removal of rules via removeRule function', () => {
      const ruleToRemove = ruleLayer.rules[1];
      ruleLayer.removeRule(ruleToRemove, UnitOfWork.immediate(diagram));

      const rules = ruleLayer.rules;
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toEqual('rule1');
    });
  });

  describe('replaceRule', () => {
    it('should replace an existing rule with a new rule via replaceRule function', () => {
      const newRule = { id: 'rule3', name: 'Rule 3', clauses: [], actions: [] };

      ruleLayer.replaceRule(
        ruleLayer.rules[0],
        { type: 'node', ...newRule },
        UnitOfWork.immediate(diagram)
      );

      const rules = ruleLayer.rules;

      expect(rules).toHaveLength(2);
      expect(rules[0].id).toEqual('rule3');
      expect(rules[1].id).toEqual('rule2');
    });
  });
});
