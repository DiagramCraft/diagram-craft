import { nodeDefaults } from '@diagram-craft/model/diagramDefaults';
import type { Editor } from './editors';
import { NodeEffectsPanelForm } from '../../toolwindow/ObjectToolWindow/NodeEffectsPanel';
import { useDiagram } from '../../../application';
import { makeProperty } from './utils';

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
      rounding={makeProperty($p, 'effects.rounding', nodeDefaults, onChange)}
      roundingAmount={makeProperty($p, 'effects.roundingAmount', nodeDefaults, onChange)}
      reflection={makeProperty($p, 'effects.reflection', nodeDefaults, onChange)}
      reflectionStrength={makeProperty($p, 'effects.reflectionStrength', nodeDefaults, onChange)}
      blur={makeProperty($p, 'effects.blur', nodeDefaults, onChange)}
      opacity={makeProperty($p, 'effects.opacity', nodeDefaults, onChange)}
      glass={makeProperty($p, 'effects.glass', nodeDefaults, onChange)}
      sketch={makeProperty($p, 'effects.sketch', nodeDefaults, onChange)}
      sketchStrength={makeProperty($p, 'effects.sketchStrength', nodeDefaults, onChange)}
      sketchFillType={makeProperty($p, 'effects.sketchFillType', nodeDefaults, onChange)}
    />
  );
};
