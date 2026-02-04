import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DrawioImageNodeDefinition } from './node-types/DrawioImage.nodeType';
import { DrawioTransparentNodeDefinition } from './node-types/DrawioTransparentShape.nodeType';
import { DrawioShapeNodeDefinition } from './node-types/DrawioShape.nodeType';

export const registerDrawioBaseNodeTypes = (reg: NodeDefinitionRegistry) => {
  reg.register(new DrawioImageNodeDefinition());
  reg.register(new DrawioTransparentNodeDefinition());
  reg.register(new DrawioShapeNodeDefinition('drawio', 'DrawIO Shape'));
};
