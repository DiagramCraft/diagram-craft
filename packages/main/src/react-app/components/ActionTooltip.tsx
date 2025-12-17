import {
  type ActionName,
  findKeyBindingsForAction,
  formatKeyBinding
} from '@diagram-craft/canvas/keyMap';
import { useApplication } from '../../application';
import { mustExist } from '@diagram-craft/utils/assert';
import { $t } from '@diagram-craft/utils/localize';

type Props = {
  action: ActionName;
};

export const ActionTooltip = (props: Props) => {
  const app = useApplication();

  const action = mustExist(app.actions[props.action]);
  const name = action.name;
  const keybinding = formatKeyBinding(findKeyBindingsForAction(props.action, app.keyMap)[0]);

  return (
    <div>
      {$t(name)}
      {keybinding && (
        <span style={{ color: 'var(--accent-fg)', marginLeft: '0.5rem' }}>{keybinding}</span>
      )}
    </div>
  );
};
