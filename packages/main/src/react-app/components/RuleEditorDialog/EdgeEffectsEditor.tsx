import { edgeDefaults } from '@diagram-craft/model/diagramDefaults';
import type { Editor } from './editors';
import { EdgeEffectsPanelForm } from '../../toolwindow/ObjectToolWindow/EdgeEffectsPanel';
import { makeProperty } from './utils';

export const EdgeEffectsEditor: Editor = props => {
  const $p = props.props as EdgeProps;

  const onChange = () => {
    props.onChange();
  };

  return (
    <EdgeEffectsPanelForm
      opacity={makeProperty($p, 'effects.opacity', edgeDefaults, onChange)}
      sketch={makeProperty($p, 'effects.sketch', edgeDefaults, onChange)}
      sketchStrength={makeProperty($p, 'effects.sketchStrength', edgeDefaults, onChange)}
      marchingAnts={makeProperty($p, 'effects.marchingAnts', edgeDefaults, onChange)}
      marchingAntsSpeed={makeProperty($p, 'effects.marchingAntsSpeed', edgeDefaults, onChange)}
      rounding={makeProperty($p, 'effects.rounding', edgeDefaults, onChange)}
      roundingAmount={makeProperty($p, 'effects.roundingAmount', edgeDefaults, onChange)}
    />
  );
};
