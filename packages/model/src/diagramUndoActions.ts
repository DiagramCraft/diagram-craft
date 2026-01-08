import { DiagramElement, isNode } from './diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { ElementsSnapshot, UnitOfWork } from './unitOfWork';
import { UndoableAction } from './undoManager';
import { Diagram } from './diagram';
import { RegularLayer } from './diagramLayerRegular';
import { assertRegularLayer } from './diagramLayerUtils';

const restoreSnapshots = (e: ElementsSnapshot, diagram: Diagram, uow: UnitOfWork) => {
  for (const [id, snapshot] of e.snapshots) {
    // Addition must be handled differently ... and explicitly before this
    assert.present(snapshot);

    if (snapshot._snapshotType === 'layer') {
      const layer = diagram.layers.byId(id);
      if (layer) {
        layer.restore(snapshot, uow);
      }
    } else if (snapshot._snapshotType === 'layers') {
      diagram.layers._restore(snapshot, uow);
    } else if (snapshot._snapshotType === 'stylesheet') {
      const stylesheet = diagram.document.styles.get(id);
      if (stylesheet) {
        stylesheet.restore(snapshot, uow);
      }
    } else {
      const el = diagram.lookup(id);
      if (el) el.restore(snapshot, uow);
    }
  }
};

export class ElementAddUndoableAction implements UndoableAction {
  private snapshot: ElementsSnapshot | undefined;

  constructor(
    private readonly elements: ReadonlyArray<DiagramElement>,
    private readonly diagram: Diagram,
    private readonly layer: RegularLayer,
    public readonly description: string = 'Add node',
    private readonly parent?: DiagramElement
  ) {}

  undo(uow: UnitOfWork) {
    uow.trackChanges = true;

    this.elements.forEach(node => {
      uow.snapshot(node);
      if (this.parent) {
        this.parent.removeChild(node, uow);
      } else {
        assertRegularLayer(node.layer);
        node.layer.removeElement(node, uow);
      }
    });
    this.snapshot = uow.commit();

    this.diagram.selection.setElements(
      this.diagram.selection.elements.filter(e => !this.elements.includes(e))
    );
  }

  redo() {
    UnitOfWork.execute(this.diagram, uow => {
      this.elements.forEach(node => {
        if (isNode(node)) {
          node.invalidateAnchors(uow);
        }
        if (this.parent) {
          this.parent.addChild(node, uow);
        } else {
          this.layer.addElement(node, uow);
        }
      });

      if (this.snapshot) {
        restoreSnapshots(this.snapshot, this.diagram, uow);
      }
    });
  }
}
