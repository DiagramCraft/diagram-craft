import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { NodeAdvancedPropertiesPanelForm } from '../../toolwindow/ObjectInfoToolWindow/NodeAdvancedPropertiesPanel';

export const NodeAdvancedPropertiesEditor: Editor = props => {
  const $p = props.props as NodeProps;
  $p.stroke ??= {};
  $p.stroke.enabled = true;

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
      inheritStyle={makeProperty($p, 'inheritStyle', nodeDefaults, onChange)}
    />
  );
};
