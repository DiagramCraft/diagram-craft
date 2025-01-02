import { useConfiguration } from '../../context/ConfigurationContext';
import { elementDefaults2 } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { NodeStrokePanelForm } from '../../toolwindow/ObjectToolWindow/NodeStrokePanel';
import { useDiagram } from '../../../application';

export const NodeStrokeEditor: Editor = props => {
  const $p = props.props;
  $p.stroke ??= {};
  $p.stroke.enabled = true;

  const $cfg = useConfiguration();
  const diagram = useDiagram();

  const onChange = () => {
    props.onChange();
  };

  return (
    <NodeStrokePanelForm
      config={$cfg}
      diagram={diagram}
      strokeColor={makeProperty($p, 'stroke.color', elementDefaults2, onChange)}
      pattern={makeProperty($p, 'stroke.pattern', elementDefaults2, onChange)}
      strokeSize={makeProperty($p, 'stroke.patternSize', elementDefaults2, onChange)}
      strokeSpacing={makeProperty($p, 'stroke.patternSpacing', elementDefaults2, onChange)}
      strokeWidth={makeProperty($p, 'stroke.width', elementDefaults2, onChange)}
      lineCap={makeProperty($p, 'stroke.lineCap', elementDefaults2, onChange)}
      lineJoin={makeProperty($p, 'stroke.lineJoin', elementDefaults2, onChange)}
      miterLimit={makeProperty($p, 'stroke.miterLimit', elementDefaults2, onChange)}
    />
  );
};
