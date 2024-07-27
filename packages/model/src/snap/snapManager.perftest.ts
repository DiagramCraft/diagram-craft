import { SnapManager } from './snapManager';
import { DiagramNode } from '../diagramNode';
import { Diagram } from '../diagram';
import { Layer } from '../diagramLayer';
import { UnitOfWork } from '../unitOfWork';
import { PerformanceTest } from '@diagram-craft/utils/perftest';
import { DiagramDocument } from '../diagramDocument';
import {
  defaultEdgeRegistry,
  defaultNodeRegistry
} from '@diagram-craft/canvas-app/defaultRegistry';

export class SnapManagerPerftest implements PerformanceTest {
  private snapManager: SnapManager | undefined;

  setup(): void {
    const d = new Diagram(
      '1',
      '1',
      new DiagramDocument(defaultNodeRegistry(), defaultEdgeRegistry())
    );
    d.layers.add(new Layer('default', 'Default', [], d), UnitOfWork.immediate(d));

    UnitOfWork.execute(d, uow => {
      for (let i = 0; i < 1000; i++) {
        d.layers.active.addElement(
          new DiagramNode(i.toString(), 'box', this.randomBox(), d, d.layers.active, {}, {}),
          uow
        );
      }
    });

    this.snapManager = d.createSnapManager();
  }

  private randomBox() {
    return {
      x: Math.round(Math.random() * 1000),
      y: Math.round(Math.random() * 1000),
      w: Math.round(Math.random() * 100) + 1,
      h: Math.round(Math.random() * 100) + 1,
      r: 0
    };
  }

  testCases(): { label: string; run: () => number }[] {
    return [
      {
        label: 'snapManager',
        run: () => {
          const iter = 60;
          for (let i = 0; i < iter; i++) {
            this.snapManager!.snapMove(this.randomBox());
          }
          return iter;
        }
      }
    ];
  }
}
