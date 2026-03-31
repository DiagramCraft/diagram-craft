import { AbstractToggleAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { $tStr } from '@diagram-craft/utils/localize';
import { UserState } from '../../UserState';
import { applyThemeMode } from '../themeMode';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof toggleDarkModeActions> {}
  }
}

export const toggleDarkModeActions = (context: ActionContext) => ({
  TOGGLE_DARK_MODE: new ToggleDarkModeAction(context)
});

export class ToggleDarkModeAction extends AbstractToggleAction {
  name = $tStr('action.TOGGLE_DARK_MODE.name', 'Toggle Dark Mode');

  getStateCriteria() {
    return ActionCriteria.EventTriggered(UserState.get(), 'change', () => {
      return UserState.get().themeMode === 'dark';
    });
  }

  execute(): void {
    const themeMode = this.state ? 'light' : 'dark';
    UserState.get().themeMode = themeMode;
    applyThemeMode(themeMode);
    this.emit('actionTriggered');
  }
}
