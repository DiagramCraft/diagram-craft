import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { Application } from '../../application';
import { autoAlign, type AutoAlignMode } from '@diagram-craft/canvas/snap/autoAlign';
import type { MagnetType } from '@diagram-craft/canvas/snap/magnet';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof autoAlignActions> {}
  }
}

export type AutoAlignConfig = {
  threshold: number;
  magnetTypes: {
    canvas: boolean;
    grid: boolean;
    guide: boolean;
    node: boolean;
    distance: boolean;
    size: boolean;
  };
  mode: AutoAlignMode;
};

export const autoAlignActions = (context: Application) => ({
  AUTO_ALIGN: new AutoAlignAction(context)
});

export class AutoAlignAction extends AbstractSelectionAction<Application> {
  name = 'Auto-Align...';

  constructor(context: Application) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  execute(): void {
    const undoManager = this.context.model.activeDiagram.undoManager;
    undoManager.setMark();

    this.context.ui.showDialog({
      id: 'toolAutoAlign',
      props: {
        onChange: (config: AutoAlignConfig) => {
          undoManager.undoToMark();
          this.applyAutoAlign(config);
        }
      },
      onCancel: () => {
        undoManager.undoToMark();
        undoManager.clearRedo();
      },
      onOk: (config: AutoAlignConfig) => {
        undoManager.undoToMark();
        this.applyAutoAlign(config);
        this.emit('actionTriggered', {});
      }
    });
  }

  private applyAutoAlign(config: AutoAlignConfig): void {
    const diagram = this.context.model.activeDiagram;

    const nodesToAlign = this.getAlignableNodes();
    if (nodesToAlign.length === 0) return;

    const magnetTypes = this.getEnabledMagnetTypes(config.magnetTypes);

    const uow = new UnitOfWork(diagram, true);
    autoAlign(nodesToAlign, diagram, { ...config, magnetTypes }, uow);
    commitWithUndo(uow, 'Auto-align elements');
  }

  private getAlignableNodes(): DiagramNode[] {
    const selection = this.context.model.activeDiagram.selection;

    return selection.nodes.filter(node => {
      // Skip if not movable
      if (node.renderProps.capabilities.movable === false) {
        return false;
      }

      // Skip label nodes (they're attached to edges)
      return !node.isLabelNode();
    });
  }

  private getEnabledMagnetTypes(magnetConfig: Record<string, boolean>): MagnetType[] {
    return Object.entries(magnetConfig)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type as MagnetType);
  }
}
