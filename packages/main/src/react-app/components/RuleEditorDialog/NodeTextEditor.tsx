import { nodeDefaults2 } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { NodeTextPanelForm } from '../../toolwindow/ObjectToolWindow/NodeTextPanel';
import { useConfiguration } from '../../context/ConfigurationContext';
import { useDiagram } from '../../../application';

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
      font={makeProperty($p, 'text.font', nodeDefaults2, onChange)}
      fontSize={makeProperty($p, 'text.fontSize', nodeDefaults2, onChange)}
      lineHeight={makeProperty($p, 'text.lineHeight', nodeDefaults2, onChange)}
      isBold={makeProperty($p, 'text.bold', nodeDefaults2, onChange)}
      isItalic={makeProperty($p, 'text.italic', nodeDefaults2, onChange)}
      textDecoration={makeProperty($p, 'text.textDecoration', nodeDefaults2, onChange)}
      textTransform={makeProperty($p, 'text.textTransform', nodeDefaults2, onChange)}
      color={makeProperty($p, 'text.color', nodeDefaults2, onChange)}
      align={makeProperty($p, 'text.align', nodeDefaults2, onChange)}
      valign={makeProperty($p, 'text.valign', nodeDefaults2, onChange)}
      top={makeProperty($p, 'text.top', nodeDefaults2, onChange)}
      left={makeProperty($p, 'text.left', nodeDefaults2, onChange)}
      bottom={makeProperty($p, 'text.bottom', nodeDefaults2, onChange)}
      right={makeProperty($p, 'text.right', nodeDefaults2, onChange)}
    />
  );
};
