import { describe, expect, test, beforeEach } from 'vitest';
import { SwimlaneNodeDefinition } from './Swimlane.nodeType';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

describe('SwimlaneNodeDefinition - Collapse Behavior', () => {
  let swimlaneDefinition: SwimlaneNodeDefinition;

  beforeEach(() => {
    swimlaneDefinition = new SwimlaneNodeDefinition();
  });

  describe('toggle() - horizontal swimlane collapse', () => {
    test('horizontal swimlane collapses with width kept and height reduced', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const horizontalSwimlane = layer.addNode({
        id: 'h-swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 400, h: 200, r: 0 }
      });

      const uow = new UnitOfWork(diagram, true);
      horizontalSwimlane.updateCustomProps(
        'swimlane',
        (props: any) => {
          props.orientation = 'horizontal';
          props.collapsible = true;
        },
        uow
      );

      const initialBounds = { ...horizontalSwimlane.bounds };

      // Collapse the swimlane
      swimlaneDefinition.toggle(horizontalSwimlane, uow);

      // After collapse, width should remain the same
      // Height should be 2x titleSize (2 * 30 = 60)
      expect(horizontalSwimlane.bounds.w).toBe(initialBounds.w);
      expect(horizontalSwimlane.bounds.h).toBe(60);

      // Check mode is set to collapsed
      const collapsedProps = swimlaneDefinition.getCollapsibleProps(horizontalSwimlane);
      expect(collapsedProps.mode).toBe('collapsed');

      // Check expanded bounds are saved
      expect(collapsedProps.bounds).toContain(`${initialBounds.h}`);
    });

    test('collapsed horizontal swimlane expands back to original size', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const horizontalSwimlane = layer.addNode({
        id: 'h-swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 400, h: 200, r: 0 }
      });

      const uow = new UnitOfWork(diagram, true);
      horizontalSwimlane.updateCustomProps(
        'swimlane',
        (props: any) => {
          props.orientation = 'horizontal';
          props.collapsible = true;
        },
        uow
      );

      const initialBounds = { ...horizontalSwimlane.bounds };

      // Collapse
      swimlaneDefinition.toggle(horizontalSwimlane, uow);

      // Expand
      swimlaneDefinition.toggle(horizontalSwimlane, uow);

      // Should return to original dimensions
      expect(horizontalSwimlane.bounds.w).toBe(initialBounds.w);
      expect(horizontalSwimlane.bounds.h).toBe(initialBounds.h);

      // Check mode is set to expanded
      const expandedProps = swimlaneDefinition.getCollapsibleProps(horizontalSwimlane);
      expect(expandedProps.mode).toBe('expanded');
    });
  });

  describe('toggle() - vertical swimlane collapse', () => {
    test('vertical swimlane collapses with height kept and width reduced', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const verticalSwimlane = layer.addNode({
        id: 'v-swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 200, h: 400, r: 0 }
      });

      const uow = new UnitOfWork(diagram, true);
      verticalSwimlane.updateCustomProps(
        'swimlane',
        (props: any) => {
          props.orientation = 'vertical';
          props.collapsible = true;
        },
        uow
      );

      const initialBounds = { ...verticalSwimlane.bounds };

      // Collapse the swimlane
      swimlaneDefinition.toggle(verticalSwimlane, uow);

      // After collapse, height should remain the same
      // Width should be 2x titleSize (2 * 30 = 60)
      expect(verticalSwimlane.bounds.h).toBe(initialBounds.h);
      expect(verticalSwimlane.bounds.w).toBe(60);

      // Check mode is set to collapsed
      const collapsedProps = swimlaneDefinition.getCollapsibleProps(verticalSwimlane);
      expect(collapsedProps.mode).toBe('collapsed');
    });

    test('collapsed vertical swimlane expands back to original size', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const verticalSwimlane = layer.addNode({
        id: 'v-swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 200, h: 400, r: 0 }
      });

      const uow = new UnitOfWork(diagram, true);
      verticalSwimlane.updateCustomProps(
        'swimlane',
        (props: any) => {
          props.orientation = 'vertical';
          props.collapsible = true;
        },
        uow
      );

      const initialBounds = { ...verticalSwimlane.bounds };

      // Collapse
      swimlaneDefinition.toggle(verticalSwimlane, uow);

      // Expand
      swimlaneDefinition.toggle(verticalSwimlane, uow);

      // Should return to original dimensions
      expect(verticalSwimlane.bounds.w).toBe(initialBounds.w);
      expect(verticalSwimlane.bounds.h).toBe(initialBounds.h);

      // Check mode is set to expanded
      const expandedProps = swimlaneDefinition.getCollapsibleProps(verticalSwimlane);
      expect(expandedProps.mode).toBe('expanded');
    });
  });

  describe('toggle() - custom title size', () => {
    test('collapsed size respects custom title size', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const swimlane = layer.addNode({
        id: 'swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 400, h: 200, r: 0 }
      });

      const customTitleSize = 50;
      const uow = new UnitOfWork(diagram, true);
      swimlane.updateCustomProps(
        'swimlane',
        (props: any) => {
          props.orientation = 'horizontal';
          props.collapsible = true;
          props.titleSize = customTitleSize;
        },
        uow
      );

      // Collapse
      swimlaneDefinition.toggle(swimlane, uow);

      // Collapsed height should be 2x titleSize for horizontal swimlane
      expect(swimlane.bounds.h).toBe(customTitleSize * 2);
      // Width should remain unchanged
      expect(swimlane.bounds.w).toBe(400);
    });

    test('remembers manually resized collapsed size', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const swimlane = layer.addNode({
        id: 'swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 400, h: 200, r: 0 }
      });

      const uow = new UnitOfWork(diagram, true);
      swimlane.updateCustomProps(
        'swimlane',
        (props: any) => {
          props.orientation = 'vertical';
          props.collapsible = true;
        },
        uow
      );

      // Collapse (default: w=60, h=200 - height stays the same)
      swimlaneDefinition.toggle(swimlane, uow);
      expect(swimlane.bounds.w).toBe(60);
      expect(swimlane.bounds.h).toBe(200);

      // Manually resize while collapsed
      swimlane.setBounds({ ...swimlane.bounds, w: 100 }, uow);
      expect(swimlane.bounds.w).toBe(100);

      // Expand
      swimlaneDefinition.toggle(swimlane, uow);
      expect(swimlane.bounds.w).toBe(400); // Back to original width
      expect(swimlane.bounds.h).toBe(200); // Back to original height

      // Collapse again - should remember the resized width of 100
      swimlaneDefinition.toggle(swimlane, uow);
      expect(swimlane.bounds.w).toBe(100); // Remembers manual resize
      expect(swimlane.bounds.h).toBe(200); // Still keeps original height
    });
  });

  describe('shouldRenderChildren()', () => {
    test('children are not rendered when swimlane is collapsed', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const swimlane = layer.addNode({
        id: 'swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 400, h: 200, r: 0 }
      });

      const uow = new UnitOfWork(diagram, true);
      swimlane.updateCustomProps(
        'swimlane',
        (props: any) => {
          props.collapsible = true;
        },
        uow
      );

      // Initially should render children
      expect(swimlaneDefinition.shouldRenderChildren(swimlane)).toBe(true);

      // Collapse
      swimlaneDefinition.toggle(swimlane, uow);

      // Should not render children when collapsed
      expect(swimlaneDefinition.shouldRenderChildren(swimlane)).toBe(false);

      // Expand
      swimlaneDefinition.toggle(swimlane, uow);

      // Should render children again
      expect(swimlaneDefinition.shouldRenderChildren(swimlane)).toBe(true);
    });
  });

  describe('getCollapsibleProps()', () => {
    test('returns correct default props', () => {
      const { layer } = TestModel.newDiagramWithLayer();

      const swimlane = layer.addNode({
        id: 'swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 }
      });

      const props = swimlaneDefinition.getCollapsibleProps(swimlane);

      expect(props.collapsible).toBe(false);
      expect(props.mode).toBe('expanded');
      expect(props.bounds).toBe('');
    });

    test('returns correct props after enabling collapsible', () => {
      const { diagram, layer } = TestModel.newDiagramWithLayer();

      const swimlane = layer.addNode({
        id: 'swimlane',
        type: 'swimlane',
        bounds: { x: 0, y: 0, w: 200, h: 200, r: 0 }
      });

      const uow = new UnitOfWork(diagram, true);
      swimlane.updateCustomProps(
        'swimlane',
        (props: any) => {
          props.collapsible = true;
        },
        uow
      );

      const props = swimlaneDefinition.getCollapsibleProps(swimlane);

      expect(props.collapsible).toBe(true);
      expect(props.mode).toBe('expanded');
    });
  });
});
