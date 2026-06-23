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
      return UserState.get().effectiveTheme === 'dark';
    });
  }

  execute(): void {
    const userState = UserState.get();

    // Toggle between light and dark only
    userState.themePreference = userState.effectiveTheme === 'dark' ? 'light' : 'dark';
    applyThemeMode(userState.effectiveTheme);

    // Dispatch custom event for same-window sync with arch-register
    window.dispatchEvent(
      new CustomEvent('diagram-craft:theme-change', {
        detail: { themeMode: userState.effectiveTheme }
      })
    );

    this.emit('actionTriggered');
  }
}
