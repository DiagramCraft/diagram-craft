import { useConfiguration } from '../../context/ConfigurationContext';
import { elementDefaults } from '@diagram-craft/model/diagramDefaults';
import type { Editor } from './editors';
import { NodeStrokePanelForm } from '../../toolwindow/ObjectToolWindow/NodeStrokePanel';
import { useDiagram } from '../../../application';
import { makeProperty } from './utils';

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
      strokeColor={makeProperty($p, 'stroke.color', elementDefaults, onChange)}
      pattern={makeProperty($p, 'stroke.pattern', elementDefaults, onChange)}
      strokeSize={makeProperty($p, 'stroke.patternSize', elementDefaults, onChange)}
      strokeSpacing={makeProperty($p, 'stroke.patternSpacing', elementDefaults, onChange)}
      strokeWidth={makeProperty($p, 'stroke.width', elementDefaults, onChange)}
      lineCap={makeProperty($p, 'stroke.lineCap', elementDefaults, onChange)}
      lineJoin={makeProperty($p, 'stroke.lineJoin', elementDefaults, onChange)}
      miterLimit={makeProperty($p, 'stroke.miterLimit', elementDefaults, onChange)}
    />
  );
};
