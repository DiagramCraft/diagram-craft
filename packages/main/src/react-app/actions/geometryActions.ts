import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { Application } from '../../application';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { applyBooleanOperation, BooleanOperation } from '@diagram-craft/geometry/pathClip';
import { RegularLayer } from '@diagram-craft/model/diagramLayerRegular';
import { newid } from '@diagram-craft/utils/id';
import { ActionCriteria } from '@diagram-craft/canvas/action';
import { toUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { transformPathList } from '@diagram-craft/geometry/pathListUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { $tStr, type TranslatedString } from '@diagram-craft/utils/localize';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof geometryActions> {}
  }
}

export const geometryActions = (context: Application) => ({
  SELECTION_GEOMETRY_CONVERT_TO_CURVES: new SelectionGeometryConvertToCurves(context),
  SELECTION_GEOMETRY_BOOLEAN_UNION: new SelectionBooleanOperation(
    context,
    $tStr('action.SELECTION_GEOMETRY_BOOLEAN_UNION.name', 'Union'),
    'A union B'
  ),
  SELECTION_GEOMETRY_BOOLEAN_A_NOT_B: new SelectionBooleanOperation(
    context,
    $tStr('action.SELECTION_GEOMETRY_BOOLEAN_A_NOT_B.name', 'Subtract'),
    'A not B'
  ),
  SELECTION_GEOMETRY_BOOLEAN_B_NOT_A: new SelectionBooleanOperation(
    context,
    $tStr('action.SELECTION_GEOMETRY_BOOLEAN_B_NOT_A.name', 'Subtract (B not A)'),
    'B not A'
  ),
  SELECTION_GEOMETRY_BOOLEAN_INTERSECTION: new SelectionBooleanOperation(
    context,
    $tStr('action.SELECTION_GEOMETRY_BOOLEAN_INTERSECTION.name', 'Intersect'),
    'A intersection B'
  ),
  SELECTION_GEOMETRY_BOOLEAN_XOR: new SelectionBooleanOperation(
    context,
    $tStr('action.SELECTION_GEOMETRY_BOOLEAN_INTERSECTION.name', 'Exclusive Or'),
    'A xor B'
  ),
  SELECTION_GEOMETRY_BOOLEAN_DIVIDE: new SelectionBooleanOperation(
    context,
    $tStr('action.SELECTION_GEOMETRY_BOOLEAN_INTERSECTION.name', 'Divide'),
    'A divide B'
  )
});

class SelectionGeometryConvertToCurves extends AbstractSelectionAction<Application> {
  name = $tStr('action.SELECTION_GEOMETRY_CONVERT_TO_CURVES.name', 'Convert to curves');

  constructor(context: Application) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  execute() {
    const nodes = this.context.model.activeDiagram.selection.nodes;

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
          UnitOfWork.executeWithUndo(this.context.model.activeDiagram, 'Convert to path', uow => {
            for (const el of nodes) {
              el.convertToPath(uow);
            }
          });
        }
      )
    );
  }
}

class SelectionBooleanOperation extends AbstractSelectionAction<Application> {
  constructor(
    context: Application,
    public readonly name: TranslatedString,
    private type: BooleanOperation
  ) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  getCriteria(context: Application) {
    const cb = () => {
      const $s = context.model.activeDiagram.selection;
      return $s.nodes.length === 2;
    };

    return [
      ...super.getCriteria(context),

      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'add', cb),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'remove', cb)
    ];
  }
  execute() {
    const diagram = this.context.model.activeDiagram;

    const nodes = diagram.selection.nodes;

    // TODO: Convert to condition
    if (nodes.length !== 2) return;

    const a = nodes[0]!.getDefinition().getBoundingPath(nodes[0]!);
    const b = nodes[1]!.getDefinition().getBoundingPath(nodes[1]!);

    const paths = applyBooleanOperation(a, b, this.type);
    const newNodes = paths.map(p => {
      const nodeBounds = p.bounds();

      const scaledPath = transformPathList(p, toUnitLCS(nodeBounds));

      return ElementFactory.node(
        newid(),
        'generic-path',
        nodeBounds,
        diagram.activeLayer as RegularLayer,
        {
          ...nodes[0]!.storedProps,
          custom: {
            genericPath: {
              path: scaledPath.asSvgPath()
            }
          }
        },
        {
          ...nodes[0]!.metadata
        }
      );
    });

    UnitOfWork.executeWithUndo(diagram, 'Boolean operation', uow => {
      nodes.forEach(n => {
        const layer = n.layer;
        assertRegularLayer(layer);
        layer.removeElement(n, uow);
      });

      newNodes.forEach(n => {
        (diagram.activeLayer as RegularLayer).addElement(n, uow);
      });

      diagram.selection.setElements(newNodes);
      uow.on('after', 'undo', () => diagram.selection.setElements(nodes));
      uow.on('after', 'redo', () => diagram.selection.setElements(newNodes));
    });

    diagram.selection.setElements(newNodes);
  }
}
