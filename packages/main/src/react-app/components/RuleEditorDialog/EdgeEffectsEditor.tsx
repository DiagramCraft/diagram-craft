import { edgeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Editor, makeProperty } from './editors';
import { EdgeEffectsPanelForm } from '../../toolwindow/ObjectToolWindow/EdgeEffectsPanel';

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
    />
  );
};
