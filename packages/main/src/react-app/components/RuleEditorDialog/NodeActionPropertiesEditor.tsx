import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import type { Editor } from './editors';
import { makeProperty } from './utils';
import { NodeActionPropertiesPanelForm } from '../../toolwindow/ObjectToolWindow/NodeActionPropertiesPanel';
import type { NodeProps } from '@diagram-craft/model/diagramProps';

export const NodeActionPropertiesEditor: Editor = props => {
  const $p = props.props as NodeProps;

  const onChange = () => {
    props.onChange();
  };

  return (
    <NodeActionPropertiesPanelForm
      type={makeProperty($p, 'action.type', nodeDefaults, onChange)}
      url={makeProperty($p, 'action.url', nodeDefaults, onChange)}
    />
  );
};
