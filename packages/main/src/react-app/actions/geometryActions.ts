import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { Application } from '@diagram-craft/main/application';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  commitWithUndo,
  ElementAddUndoableAction,
  ElementDeleteUndoableAction
} from '@diagram-craft/model/diagramUndoActions';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { applyBooleanOperation, BooleanOperation } from '@diagram-craft/geometry/pathClip';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { RegularLayer } from '@diagram-craft/model/diagramLayer';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { newid } from '@diagram-craft/utils/id';
import { ActionCriteria } from '@diagram-craft/canvas/action';
import { toUnitLCS } from '@diagram-craft/geometry/pathListBuilder';

declare global {
  interface ActionMap extends ReturnType<typeof geometryActions> {}
}

export const geometryActions = (context: Application) => ({
  SELECTION_GEOMETRY_CONVERT_TO_CURVES: new SelectionGeometryConvertToCurves(context),
  SELECTION_GEOMETRY_BOOLEAN_UNION: new SelectionBooleanOperation(context, 'A union B'),
  SELECTION_GEOMETRY_BOOLEAN_A_NOT_B: new SelectionBooleanOperation(context, 'A not B'),
  SELECTION_GEOMETRY_BOOLEAN_B_NOT_A: new SelectionBooleanOperation(context, 'B not A'),
  SELECTION_GEOMETRY_BOOLEAN_INTERSECTION: new SelectionBooleanOperation(
    context,
    'A intersection B'
  ),
  SELECTION_GEOMETRY_BOOLEAN_XOR: new SelectionBooleanOperation(context, 'A xor B'),
  SELECTION_GEOMETRY_BOOLEAN_DIVIDE: new SelectionBooleanOperation(context, 'A divide B')
});

class SelectionGeometryConvertToCurves extends AbstractSelectionAction<Application> {
  constructor(context: Application) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  execute() {
    const nodes = this.context.model.activeDiagram.selectionState.nodes;

    if (nodes.every(n => n.nodeType === 'generic-path')) return;

    this.context.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Convert to path',
          message: 'Do you want to convert this shape to a editable path?',
          okLabel: 'Yes',
          cancelLabel: 'Cancel'
        },
        () => {
          const uow = new UnitOfWork(this.context.model.activeDiagram, true);
          for (const el of nodes) {
            el.convertToPath(uow);
          }
          commitWithUndo(uow, 'Convert to path');
        }
      )
    );
  }
}

class SelectionBooleanOperation extends AbstractSelectionAction<Application> {
  constructor(
    context: Application,
    private type: BooleanOperation
  ) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  getCriteria(context: Application) {
    const cb = () => {
      const $s = context.model.activeDiagram.selectionState;
      return $s.nodes.length === 2;
    };

    return [
      ...super.getCriteria(context),

      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'add', cb),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'remove', cb)
    ];
  }
  execute() {
    const diagram = this.context.model.activeDiagram;

    const nodes = diagram.selectionState.nodes;

    // TODO: Convert to condition
    if (nodes.length !== 2) return;

    const a = nodes[0].getDefinition().getBoundingPath(nodes[0]);
    const b = nodes[1].getDefinition().getBoundingPath(nodes[1]);

    const paths = applyBooleanOperation(a, b, this.type);
    const newNodes = paths.map(p => {
      const nodeBounds = p.bounds();

      const scaledPath = p.transform(toUnitLCS(nodeBounds));

      return new DiagramNode(
        newid(),
        'generic-path',
        nodeBounds,
        diagram,
        diagram.activeLayer as RegularLayer,
        {
          ...nodes[0].storedProps,
          custom: {
            genericPath: {
              path: scaledPath.asSvgPath()
            }
          }
        },
        {
          ...nodes[0].metadata
        }
      );
    });

    diagram.undoManager.addAndExecute(
      new CompoundUndoableAction([
        new ElementDeleteUndoableAction(diagram, diagram.activeLayer as RegularLayer, nodes, true),
        new ElementAddUndoableAction(newNodes, diagram, diagram.activeLayer as RegularLayer)
      ])
    );
    diagram.selectionState.setElements(newNodes);
  }
}
