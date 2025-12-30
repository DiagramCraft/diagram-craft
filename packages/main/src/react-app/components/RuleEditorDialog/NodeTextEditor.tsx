import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import type { Editor } from './editors';
import { NodeTextPanelForm } from '../../toolwindow/ObjectToolWindow/NodeTextPanel';
import { useConfiguration } from '../../context/ConfigurationContext';
import { useDiagram } from '../../../application';
import { makeProperty } from './utils';
import type { NodeProps } from '@diagram-craft/model/diagramProps';

export const NodeTextEditor: Editor = props => {
  const $p = props.props as NodeProps;

  const diagram = useDiagram();
  const config = useConfiguration();

  const onChange = () => {
    props.onChange();
  };

  return (
    <NodeTextPanelForm
      diagram={diagram}
      config={config}
      font={makeProperty($p, 'text.font', nodeDefaults, onChange)}
      fontSize={makeProperty($p, 'text.fontSize', nodeDefaults, onChange)}
      lineHeight={makeProperty($p, 'text.lineHeight', nodeDefaults, onChange)}
      isBold={makeProperty($p, 'text.bold', nodeDefaults, onChange)}
      isItalic={makeProperty($p, 'text.italic', nodeDefaults, onChange)}
      textDecoration={makeProperty($p, 'text.textDecoration', nodeDefaults, onChange)}
      textTransform={makeProperty($p, 'text.textTransform', nodeDefaults, onChange)}
      color={makeProperty($p, 'text.color', nodeDefaults, onChange)}
      align={makeProperty($p, 'text.align', nodeDefaults, onChange)}
      valign={makeProperty($p, 'text.valign', nodeDefaults, onChange)}
      top={makeProperty($p, 'text.top', nodeDefaults, onChange)}
      left={makeProperty($p, 'text.left', nodeDefaults, onChange)}
      bottom={makeProperty($p, 'text.bottom', nodeDefaults, onChange)}
      right={makeProperty($p, 'text.right', nodeDefaults, onChange)}
      shrink={makeProperty($p, 'text.shrink', nodeDefaults, onChange)}
    />
  );
};
