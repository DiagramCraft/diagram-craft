import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DrawioImageNodeDefinition } from './DrawioImage.nodeType';
import { DrawioTransparentNodeDefinition } from './DrawioTransparentShape.nodeType';
import { DrawioShapeNodeDefinition } from './DrawioShape.nodeType';

export const registerDrawioBaseNodeTypes = (reg: NodeDefinitionRegistry) => {
  reg.register(new DrawioImageNodeDefinition());
  reg.register(new DrawioTransparentNodeDefinition());
  reg.register(new DrawioShapeNodeDefinition('drawio', 'DrawIO Shape'));
};
