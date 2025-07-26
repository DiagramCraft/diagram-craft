import { describe, expect, it } from 'vitest';
import { RuleLayer } from './diagramLayerRule';
import { UnitOfWork } from './unitOfWork';
import { Backends, standardTestModel } from './collaboration/collaborationTestUtils';

describe.each(Backends.all())('RuleLayer [%s]', (_name, backend) => {
  describe('rules', () => {
    it('should return all the rules added to the layer', () => {
      // Setup
      const { diagram1, diagram2 } = standardTestModel(backend);

      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram1, [
        { id: 'rule1', name: 'Rule 1', actions: [], type: 'node', clauses: [] },
        { id: 'rule2', name: 'Rule 2', actions: [], type: 'node', clauses: [] }
      ]);
      diagram1.layers.add(ruleLayer, UnitOfWork.immediate(diagram1));

      // Verify
      const rules = ruleLayer.rules;

      expect(rules).toHaveLength(2);
      expect(rules[0].id).toEqual('rule1');
      expect(rules[1].id).toEqual('rule2');

      if (diagram2) {
        const rules2 = (diagram2.layers.byId('layer1') as RuleLayer).rules;
        expect(rules2.length).toEqual(2);
        expect(rules2[0].id).toEqual('rule1');
        expect(rules2[1].id).toEqual('rule2');
      }
    });
  });

  describe('addRule', () => {
    it('should reflect newly added rules via addRule function', () => {
      // Setup
      const { diagram1, diagram2 } = standardTestModel(backend);

      const newRule = { id: 'rule3', name: 'Rule 3', clauses: [], actions: [] };

      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram1, [
        { id: 'rule1', name: 'Rule 1', actions: [], type: 'node', clauses: [] },
        { id: 'rule2', name: 'Rule 2', actions: [], type: 'node', clauses: [] }
      ]);
      diagram1.layers.add(ruleLayer, UnitOfWork.immediate(diagram1));

      // Act
      ruleLayer.addRule({ ...newRule, type: 'node' }, UnitOfWork.immediate(diagram1));

      const rules = ruleLayer.rules;
      expect(rules).toHaveLength(3);
      expect(rules[2].id).toEqual('rule3');

      if (diagram2) {
        expect((diagram2.layers.byId('layer1') as RuleLayer).rules.length).toEqual(3);
        expect((diagram2.layers.byId('layer1') as RuleLayer).rules[2].id).toEqual('rule3');
      }
    });
  });

  describe('removeRule', () => {
    it('should reflect removal of rules via removeRule function', () => {
      // Setup
      const { diagram1, diagram2 } = standardTestModel(backend);

      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram1, [
        { id: 'rule1', name: 'Rule 1', actions: [], type: 'node', clauses: [] },
        { id: 'rule2', name: 'Rule 2', actions: [], type: 'node', clauses: [] }
      ]);
      diagram1.layers.add(ruleLayer, UnitOfWork.immediate(diagram1));

      // Act
      ruleLayer.removeRule(ruleLayer.rules[1], UnitOfWork.immediate(diagram1));

      // Verify
      const rules = ruleLayer.rules;
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toEqual('rule1');

      if (diagram2) {
        expect((diagram2.layers.byId('layer1') as RuleLayer).rules.length).toEqual(1);
        expect((diagram2.layers.byId('layer1') as RuleLayer).rules[0].id).toEqual('rule1');
      }
    });
  });

  describe('replaceRule', () => {
    it('should replace an existing rule with a new rule via replaceRule function', () => {
      // Setup
      const { diagram1, diagram2 } = standardTestModel(backend);

      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram1, [
        { id: 'rule1', name: 'Rule 1', actions: [], type: 'node', clauses: [] },
        { id: 'rule2', name: 'Rule 2', actions: [], type: 'node', clauses: [] }
      ]);
      diagram1.layers.add(ruleLayer, UnitOfWork.immediate(diagram1));

      const newRule = { id: 'rule3', name: 'Rule 3', clauses: [], actions: [] };

      // Act
      ruleLayer.replaceRule(
        ruleLayer.rules[0],
        { type: 'node', ...newRule },
        UnitOfWork.immediate(diagram1)
      );

      // Verify
      const rules = ruleLayer.rules;

      expect(rules).toHaveLength(2);
      expect(rules[0].id).toEqual('rule3');
      expect(rules[1].id).toEqual('rule2');

      if (diagram2) {
        const rules = (diagram2.layers.byId('layer1') as RuleLayer).rules;
        expect(rules.length).toEqual(2);
        expect(rules[0].id).toEqual('rule3');
        expect(rules[1].id).toEqual('rule2');
      }
    });
  });
});
