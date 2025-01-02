import { useConfiguration } from '../../context/ConfigurationContext';
import { elementDefaults2 } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { ElementShadowPanelForm } from '../../toolwindow/ObjectToolWindow/ElementShadowPanel';
import { useDiagram } from '../../../application';

export const ElementShadowEditor: Editor = props => {
  const $p = props.props;
  $p.shadow ??= {};
  $p.shadow.enabled = true;

  const $cfg = useConfiguration();
  const diagram = useDiagram();

  const onChange = () => {
    props.onChange();
  };

  return (
    <ElementShadowPanelForm
      config={$cfg}
      diagram={diagram}
      color={makeProperty($p, 'shadow.color', elementDefaults2, onChange)}
      opacity={makeProperty($p, 'shadow.opacity', elementDefaults2, onChange)}
      x={makeProperty($p, 'shadow.x', elementDefaults2, onChange)}
      y={makeProperty($p, 'shadow.y', elementDefaults2, onChange)}
      blur={makeProperty($p, 'shadow.blur', elementDefaults2, onChange)}
    />
  );
};
