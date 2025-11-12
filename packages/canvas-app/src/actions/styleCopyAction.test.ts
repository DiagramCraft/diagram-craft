import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { StyleCopyAction, StylePasteAction } from './styleCopyAction';
import type { StandardTestModel } from '@diagram-craft/model/test-support/collaborationModelTestUtils';
import { standardTestModel } from '@diagram-craft/model/test-support/collaborationModelTestUtils';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';
import type { ActionContext } from '@diagram-craft/canvas/action';
import type { Diagram } from '@diagram-craft/model/diagram';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

// Dummy implementation
const mkContext = (d: Diagram) => {
  return {
    model: {
      activeDiagram: d,
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      on: (_a: any, _b: any, _c: any) => {}
    }
  } as ActionContext;
};

describe.each(Backends.all())('StyleCopyAction [%s]', (_name, backend) => {
  let model: StandardTestModel;

  beforeEach(() => {
    backend.beforeEach();
    model = standardTestModel(backend);
  });

  afterEach(backend.afterEach);

  describe('StyleCopyAction - nodes', () => {
    test('should copy style from selected node', () => {
      const node1 = model.layer1.addNode();

      // Set some style properties on node1
      UnitOfWork.execute(model.diagram1, uow =>
        node1.updateProps(props => {
          props.stroke ??= {};
          props.stroke.color = 'red';
          props.stroke.width = 5;
          props.fill ??= {};
          props.fill.color = 'blue';
        }, uow)
      );

      // Select the node and copy its style
      model.diagram1.selection.setElements([node1]);
      const copyAction = new StyleCopyAction(mkContext(model.diagram1));
      copyAction.execute();

      // Create a new node with different styles
      const node2 = model.layer1.addNode();
      UnitOfWork.execute(model.diagram1, uow =>
        node2.updateProps(props => {
          props.stroke ??= {};
          props.stroke.color = 'green';
          props.stroke.width = 2;
        }, uow)
      );

      // Select node2 and paste the style
      model.diagram1.selection.setElements([node2]);
      const pasteAction = new StylePasteAction(mkContext(model.diagram1));
      pasteAction.execute();

      // Verify the style was pasted
      expect(node2.storedProps.stroke?.color).toBe('red');
      expect(node2.storedProps.stroke?.width).toBe(5);
      expect(node2.storedProps.fill?.color).toBe('blue');

      if (model.doc2) {
        const node2_d2 = model.diagram2!.lookup(node2.id) as DiagramNode;
        expect(node2_d2.storedProps.stroke?.color).toBe('red');
        expect(node2_d2.storedProps.stroke?.width).toBe(5);
        expect(node2_d2.storedProps.fill?.color).toBe('blue');
      }
    });
  });
});
