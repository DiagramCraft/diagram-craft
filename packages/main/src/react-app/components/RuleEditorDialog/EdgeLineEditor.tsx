import { edgeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { EdgeLinePanelForm } from '../../toolwindow/ObjectToolWindow/EdgeLinePanel';
import { useDiagram } from '../../context/DiagramContext';
import { useConfiguration } from '../../context/ConfigurationContext';

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
      strokeColor={makeProperty($p, 'stroke.color', edgeDefaults, onChange)}
      fillColor={makeProperty($p, 'fill.color', edgeDefaults, onChange)}
      pattern={makeProperty($p, 'stroke.pattern', edgeDefaults, onChange)}
      strokeSize={makeProperty($p, 'stroke.patternSize', edgeDefaults, onChange)}
      strokeSpacing={makeProperty($p, 'stroke.patternSpacing', edgeDefaults, onChange)}
      strokeWidth={makeProperty($p, 'stroke.width', edgeDefaults, onChange)}
      type={makeProperty($p, 'type', edgeDefaults, onChange)}
      startType={makeProperty($p, 'arrow.start.type', edgeDefaults, onChange)}
      startSize={makeProperty($p, 'arrow.start.size', edgeDefaults, onChange)}
      endType={makeProperty($p, 'arrow.end.type', edgeDefaults, onChange)}
      endSize={makeProperty($p, 'arrow.end.size', edgeDefaults, onChange)}
      rounding={makeProperty($p, 'routing.rounding', edgeDefaults, onChange)}
      lineHopsSize={makeProperty($p, 'lineHops.size', edgeDefaults, onChange)}
      lineHopsType={makeProperty($p, 'lineHops.type', edgeDefaults, onChange)}
      lineCap={makeProperty($p, 'stroke.lineCap', edgeDefaults, onChange)}
      lineJoin={makeProperty($p, 'stroke.lineJoin', edgeDefaults, onChange)}
      miterLimit={makeProperty($p, 'stroke.miterLimit', edgeDefaults, onChange)}
    />
  );
};
