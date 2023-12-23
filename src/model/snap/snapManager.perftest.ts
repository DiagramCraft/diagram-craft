import { PerformanceTest } from '../../utils/perftest.ts';
import { SnapManager } from './snapManager.ts';
import { DiagramNode } from '../diagramNode.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '../elementDefinitionRegistry.ts';
import { Diagram } from '../diagram.ts';

export class SnapManagerPerftest implements PerformanceTest {
  private snapManager: SnapManager | undefined;

  setup(): void {
    const d = new Diagram('1', '1', new NodeDefinitionRegistry(), new EdgeDefinitionRegistry(), []);

    for (let i = 0; i < 1000; i++) {
      d.layers.active.addElement(
        new DiagramNode(i.toString(), 'box', this.randomBox(), undefined, {}, d, d.layers.active)
      );
    }

    this.snapManager = d.createSnapManager();
  }

  private randomBox() {
    return {
      pos: {
        x: Math.round(Math.random() * 1000),
        y: Math.round(Math.random() * 1000)
      },
      size: {
        w: Math.round(Math.random() * 100) + 1,
        h: Math.round(Math.random() * 100) + 1
      },
      rotation: 0
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
