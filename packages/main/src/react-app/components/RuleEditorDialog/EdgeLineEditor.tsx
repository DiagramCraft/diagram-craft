import { edgeDefaults2 } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { EdgeLinePanelForm } from '../../toolwindow/ObjectToolWindow/EdgeLinePanel';
import { useConfiguration } from '../../context/ConfigurationContext';
import { useDiagram } from '../../../application';

export const EdgeLineEditor: Editor = props => {
  const $d = useDiagram();
  const $cfg = useConfiguration();
  const $p = props.props as EdgeProps;

  const onChange = () => {
    props.onChange();
  };

  return (
    <EdgeLinePanelForm
      diagram={$d}
      config={$cfg}
      supportsArrows={true}
      supportsLineHops={true}
      supportsFill={true}
      strokeColor={makeProperty($p, 'stroke.color', edgeDefaults2, onChange)}
      fillColor={makeProperty($p, 'fill.color', edgeDefaults2, onChange)}
      pattern={makeProperty($p, 'stroke.pattern', edgeDefaults2, onChange)}
      strokeSize={makeProperty($p, 'stroke.patternSize', edgeDefaults2, onChange)}
      strokeSpacing={makeProperty($p, 'stroke.patternSpacing', edgeDefaults2, onChange)}
      strokeWidth={makeProperty($p, 'stroke.width', edgeDefaults2, onChange)}
      type={makeProperty($p, 'type', edgeDefaults2, onChange)}
      startType={makeProperty($p, 'arrow.start.type', edgeDefaults2, onChange)}
      startSize={makeProperty($p, 'arrow.start.size', edgeDefaults2, onChange)}
      endType={makeProperty($p, 'arrow.end.type', edgeDefaults2, onChange)}
      endSize={makeProperty($p, 'arrow.end.size', edgeDefaults2, onChange)}
      rounding={makeProperty($p, 'routing.rounding', edgeDefaults2, onChange)}
      lineHopsSize={makeProperty($p, 'lineHops.size', edgeDefaults2, onChange)}
      lineHopsType={makeProperty($p, 'lineHops.type', edgeDefaults2, onChange)}
      lineCap={makeProperty($p, 'stroke.lineCap', edgeDefaults2, onChange)}
      lineJoin={makeProperty($p, 'stroke.lineJoin', edgeDefaults2, onChange)}
      miterLimit={makeProperty($p, 'stroke.miterLimit', edgeDefaults2, onChange)}
    />
  );
};
