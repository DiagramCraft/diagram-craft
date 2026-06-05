/**
  This type definition is needed here as the model package uses it
  when converting a node to a genericPath
 */
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      genericPath?: {
        path?: string;
      };
    }
  }
}
const DEFAULT_PATH = 'M -1 1, L 1 1, L 1 -1, L -1 -1, L -1 1';

registerCustomNodeDefaults('genericPath', { path: DEFAULT_PATH });
