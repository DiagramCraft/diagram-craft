import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import type { Editor } from './editors';
import { makeProperty } from './utils';
import { NodeAdvancedPropertiesPanelForm } from '../../toolwindow/ObjectToolWindow/NodeAdvancedPropertiesPanel';

export const NodeAdvancedPropertiesEditor: Editor = props => {
  const $p = props.props as DiagramCraft.NodeProps;

  const onChange = () => {
    props.onChange();
  };

  return (
    <NodeAdvancedPropertiesPanelForm
      resizableV={makeProperty($p, 'capabilities.resizable.vertical', nodeDefaults, onChange)}
      resizableH={makeProperty($p, 'capabilities.resizable.horizontal', nodeDefaults, onChange)}
      movable={makeProperty($p, 'capabilities.movable', nodeDefaults, onChange)}
      editable={makeProperty($p, 'capabilities.editable', nodeDefaults, onChange)}
      deletable={makeProperty($p, 'capabilities.deletable', nodeDefaults, onChange)}
      rotatable={makeProperty($p, 'capabilities.rotatable', nodeDefaults, onChange)}
      inheritStyle={makeProperty($p, 'capabilities.inheritStyle', nodeDefaults, onChange)}
      routingSpacing={makeProperty($p, 'routing.spacing', nodeDefaults, onChange)}
    />
  );
};
