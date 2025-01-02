import { nodeDefaults2 } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { NodeEffectsPanelForm } from '../../toolwindow/ObjectToolWindow/NodeEffectsPanel';
import { useDiagram } from '../../../application';

export const NodeEffectsEditor: Editor = props => {
  const $p = props.props as NodeProps;

  const diagram = useDiagram();

  const onChange = () => {
    props.onChange();
  };

  return (
    <NodeEffectsPanelForm
      diagram={diagram}
      /* @ts-ignore */
      rounding={makeProperty($p, 'effects.rounding', nodeDefaults2, onChange)}
      roundingAmount={makeProperty($p, 'effects.roundingAmount', nodeDefaults2, onChange)}
      reflection={makeProperty($p, 'effects.reflection', nodeDefaults2, onChange)}
      reflectionStrength={makeProperty($p, 'effects.reflectionStrength', nodeDefaults2, onChange)}
      blur={makeProperty($p, 'effects.blur', nodeDefaults2, onChange)}
      opacity={makeProperty($p, 'effects.opacity', nodeDefaults2, onChange)}
      glass={makeProperty($p, 'effects.glass', nodeDefaults2, onChange)}
      sketch={makeProperty($p, 'effects.sketch', nodeDefaults2, onChange)}
      sketchStrength={makeProperty($p, 'effects.sketchStrength', nodeDefaults2, onChange)}
      sketchFillType={makeProperty($p, 'effects.sketchFillType', nodeDefaults2, onChange)}
    />
  );
};
