import { nodeDefaults2 } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { NodeAdvancedPropertiesPanelForm } from '../../toolwindow/ObjectInfoToolWindow/NodeAdvancedPropertiesPanel';

export const NodeAdvancedPropertiesEditor: Editor = props => {
  const $p = props.props as NodeProps;

  const onChange = () => {
    props.onChange();
  };

  return (
    <NodeAdvancedPropertiesPanelForm
      resizableV={makeProperty($p, 'capabilities.resizable.vertical', nodeDefaults2, onChange)}
      resizableH={makeProperty($p, 'capabilities.resizable.horizontal', nodeDefaults2, onChange)}
      movable={makeProperty($p, 'capabilities.movable', nodeDefaults2, onChange)}
      editable={makeProperty($p, 'capabilities.editable', nodeDefaults2, onChange)}
      deletable={makeProperty($p, 'capabilities.deletable', nodeDefaults2, onChange)}
      rotatable={makeProperty($p, 'capabilities.rotatable', nodeDefaults2, onChange)}
      inheritStyle={makeProperty($p, 'inheritStyle', nodeDefaults2, onChange)}
    />
  );
};
