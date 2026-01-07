import { describe, expect, it } from 'vitest';
import { RuleLayer } from './diagramLayerRule';
import { UnitOfWork } from './unitOfWork';
import { standardTestModel } from './test-support/collaborationModelTestUtils';
import { Comment } from './comment';
import { newid } from '@diagram-craft/utils/id';
import { TestModel } from './test-support/testModel';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';

describe.each(Backends.all())('RuleLayer [%s]', (_name, backend) => {
  describe('rules', () => {
    it('should return all the rules added to the layer', () => {
      // Setup
      const { diagram1, diagram2 } = standardTestModel(backend);

      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram1, [
        { id: 'rule1', name: 'Rule 1', actions: [], type: 'node', clauses: [] },
        { id: 'rule2', name: 'Rule 2', actions: [], type: 'node', clauses: [] }
      ]);
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(ruleLayer, uow));

      const ruleLayer2 = diagram2 ? (diagram2.layers.byId('layer1') as RuleLayer) : undefined;

      // Verify
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule1', 'rule2']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule1', 'rule2']);
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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(ruleLayer, uow));

      const ruleLayer2 = diagram2 ? (diagram2.layers.byId('layer1') as RuleLayer) : undefined;

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'Add rule', uow =>
        ruleLayer.addRule({ ...newRule, type: 'node' }, uow)
      );

      // Verify
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule1', 'rule2', 'rule3']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule1', 'rule2', 'rule3']);

      // Act & Verify
      diagram1.undoManager.undo();
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule1', 'rule2']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule1', 'rule2']);

      // Act & Verify
      diagram1.undoManager.redo();
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule1', 'rule2', 'rule3']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule1', 'rule2', 'rule3']);
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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(ruleLayer, uow));

      const ruleLayer2 = diagram2 ? (diagram2.layers.byId('layer1') as RuleLayer) : undefined;

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'Remove rule', uow =>
        ruleLayer.removeRule(ruleLayer.rules[1]!, uow)
      );

      // Verify
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule1']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule1']);

      // Act & Verify
      diagram1.undoManager.undo();
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule1', 'rule2']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule1', 'rule2']);

      // Act & Verify
      diagram1.undoManager.redo();
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule1']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule1']);
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
      UnitOfWork.execute(diagram1, uow => diagram1.layers.add(ruleLayer, uow));

      const ruleLayer2 = diagram2 ? (diagram2.layers.byId('layer1') as RuleLayer) : undefined;

      const newRule = { id: 'rule3', name: 'Rule 3', clauses: [], actions: [] };

      // Act
      UnitOfWork.executeWithUndo(diagram1, 'Replace', uow =>
        ruleLayer.replaceRule(ruleLayer.rules[0]!, { type: 'node', ...newRule }, uow)
      );

      // Verify
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule3', 'rule2']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule3', 'rule2']);

      // Act & Verify
      diagram1.undoManager.undo();
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule1', 'rule2']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule1', 'rule2']);

      // Act & Verify
      diagram1.undoManager.redo();
      expect(ruleLayer.rules.map(e => e.id)).toEqual(['rule3', 'rule2']);
      if (ruleLayer2) expect(ruleLayer2.rules.map(e => e.id)).toEqual(['rule3', 'rule2']);
    });
  });

  describe('comment clause evaluation', () => {
    it('should match elements with any comments when no state specified', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer({
        root: backend.syncedDocs()[0],
        nodes: [{ id: 'node-1', bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } }]
      });
      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram, []);
      UnitOfWork.execute(diagram, uow => diagram.layers.add(ruleLayer, uow));

      const element = layer.elements[0]!;

      const comment = new Comment(
        diagram,
        'element',
        newid(),
        'Test comment',
        'test-author',
        new Date(),
        'unresolved',
        element
      );
      diagram.commentManager.addComment(comment);

      const rule = {
        id: 'comment-rule',
        name: 'Comment Rule',
        type: 'node' as const,
        clauses: [{ id: 'clause1', type: 'comment' as const }],
        actions: [{ id: 'action1', type: 'set-props' as const, props: {} }]
      };

      UnitOfWork.execute(diagram, uow => ruleLayer.addRule(rule, uow));
      const adjustments = ruleLayer.adjustments();

      expect(adjustments.has(element.id)).toBe(true);
    });

    it('should match elements with unresolved comments when state is unresolved', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer({
        root: backend.syncedDocs()[0],
        nodes: [{ id: 'node-1', bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } }]
      });
      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram, []);
      UnitOfWork.execute(diagram, uow => diagram.layers.add(ruleLayer, uow));

      const element = layer.elements[0]!;

      const unresolvedComment = new Comment(
        diagram,
        'element',
        newid(),
        'Unresolved comment',
        'test-author',
        new Date(),
        'unresolved',
        element
      );

      const resolvedComment = new Comment(
        diagram,
        'element',
        newid(),
        'Resolved comment',
        'test-author',
        new Date(),
        'resolved',
        element
      );

      diagram.commentManager.addComment(unresolvedComment);
      diagram.commentManager.addComment(resolvedComment);

      const rule = {
        id: 'unresolved-comment-rule',
        name: 'Unresolved Comment Rule',
        type: 'node' as const,
        clauses: [{ id: 'clause1', type: 'comment' as const, state: 'unresolved' as const }],
        actions: [{ id: 'action1', type: 'set-props' as const, props: {} }]
      };

      UnitOfWork.execute(diagram, uow => ruleLayer.addRule(rule, uow));
      const adjustments = ruleLayer.adjustments();

      expect(adjustments.has(element.id)).toBe(true);
    });

    it('should match elements with resolved comments when state is resolved', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer({
        root: backend.syncedDocs()[0],
        nodes: [{ id: 'node-1', bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } }]
      });
      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram, []);
      UnitOfWork.execute(diagram, uow => diagram.layers.add(ruleLayer, uow));

      const element = layer.elements[0]!;

      const resolvedComment = new Comment(
        diagram,
        'element',
        newid(),
        'Resolved comment',
        'test-author',
        new Date(),
        'resolved',
        element
      );

      diagram.commentManager.addComment(resolvedComment);

      const rule = {
        id: 'resolved-comment-rule',
        name: 'Resolved Comment Rule',
        type: 'node' as const,
        clauses: [{ id: 'clause1', type: 'comment' as const, state: 'resolved' as const }],
        actions: [{ id: 'action1', type: 'set-props' as const, props: {} }]
      };

      UnitOfWork.execute(diagram, uow => ruleLayer.addRule(rule, uow));
      const adjustments = ruleLayer.adjustments();

      expect(adjustments.has(element.id)).toBe(true);
    });

    it('should not match elements without comments', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer({
        root: backend.syncedDocs()[0],
        nodes: [{ id: 'node-1', bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } }]
      });
      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram, []);
      UnitOfWork.execute(diagram, uow => diagram.layers.add(ruleLayer, uow));

      const element = layer.elements[0]!;

      const rule = {
        id: 'comment-rule',
        name: 'Comment Rule',
        type: 'node' as const,
        clauses: [{ id: 'clause1', type: 'comment' as const }],
        actions: [{ id: 'action1', type: 'set-props' as const, props: {} }]
      };

      UnitOfWork.execute(diagram, uow => ruleLayer.addRule(rule, uow));
      const adjustments = ruleLayer.adjustments();

      expect(adjustments.has(element.id)).toBe(false);
    });

    it('should not match elements with only resolved comments when state is unresolved', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer({
        root: backend.syncedDocs()[0],
        nodes: [{ id: 'node-1', bounds: { x: 10, y: 10, w: 50, h: 50, r: 0 } }]
      });
      const ruleLayer = new RuleLayer('layer1', 'Test Layer', diagram, []);
      UnitOfWork.execute(diagram, uow => diagram.layers.add(ruleLayer, uow));

      const element = layer.elements[0]!;

      const resolvedComment = new Comment(
        diagram,
        'element',
        newid(),
        'Resolved comment',
        'test-author',
        new Date(),
        'resolved',
        element
      );

      diagram.commentManager.addComment(resolvedComment);

      const rule = {
        id: 'unresolved-comment-rule',
        name: 'Unresolved Comment Rule',
        type: 'node' as const,
        clauses: [{ id: 'clause1', type: 'comment' as const, state: 'unresolved' as const }],
        actions: [{ id: 'action1', type: 'set-props' as const, props: {} }]
      };

      UnitOfWork.execute(diagram, uow => ruleLayer.addRule(rule, uow));
      const adjustments = ruleLayer.adjustments();

      expect(adjustments.has(element.id)).toBe(false);
    });
  });
});
