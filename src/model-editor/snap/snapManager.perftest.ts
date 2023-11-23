import { PerformanceTest } from '../../utils/perftest.ts';
import {
  DiagramNode,
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry
} from '../../model-viewer/diagram.ts';
import { SnapManager } from './snapManager.ts';
import { EditableDiagram } from '../editable-diagram.ts';

export class SnapManagerPerftest implements PerformanceTest {
  private snapManager: SnapManager | undefined;

  setup(): void {
    const defs: DiagramNode[] = [];
    for (let i = 0; i < 1000; i++) {
      defs.push(new DiagramNode(i.toString(), 'box', this.randomBox(), undefined));
    }

    const d = new EditableDiagram(
      '1',
      defs,
      new NodeDefinitionRegistry(),
      new EdgeDefinitionRegistry()
    );
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

  testCases(): { label: string; run: () => void }[] {
    return [
      {
        label: 'snapManager',
        run: () => {
          for (let i = 0; i < 60; i++) {
            this.snapManager!.snapMove(this.randomBox());
          }
        }
      }
    ];
  }
}
