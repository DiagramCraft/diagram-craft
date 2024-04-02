import { EditableWaypointType } from '../../react-canvas-editor/tools/node/editablePath.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';

declare global {
  interface NodeProps {
    genericPath?: {
      path?: string;
      waypointTypes?: EditableWaypointType[];
    };
  }
}

const DEFAULT_PATH = 'M -1 1, L 1 1, L 1 -1, L -1 -1, L -1 1';

export class GenericPathNodeDefinition extends AbstractReactNodeDefinition {
  constructor(name = 'generic-path', displayName = 'Path') {
    super(name, displayName);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    return PathBuilder.fromString(
      def.props.genericPath?.path ?? DEFAULT_PATH,
      unitCoordinateSystem(def.bounds)
    );
  }
}
