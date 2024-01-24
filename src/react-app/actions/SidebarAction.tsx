import { UserState } from '../../base-ui/UserState.ts';
import { ActionMapFactory, AppState } from '../../base-ui/keyMap.ts';
import { AbstractToggleAction } from '../../base-ui/action.ts';

declare global {
  interface ActionMap {
    SIDEBAR_SHAPES: SidebarAction;
    SIDEBAR_LAYERS: SidebarAction;
    SIDEBAR_SELECT: SidebarAction;
    SIDEBAR_DOCUMENT: SidebarAction;
    SIDEBAR_HISTORY: SidebarAction;
    SIDEBAR_STYLE: SidebarAction;
    SIDEBAR_INFO: SidebarAction;
    SIDEBAR_DATA: SidebarAction;
  }
}

export const sidebarActions: ActionMapFactory = (state: AppState) => ({
  SIDEBAR_SHAPES: new SidebarAction('left', 0, state.userState),
  SIDEBAR_LAYERS: new SidebarAction('left', 1, state.userState),
  SIDEBAR_SELECT: new SidebarAction('left', 2, state.userState),
  SIDEBAR_DOCUMENT: new SidebarAction('left', 3, state.userState),
  SIDEBAR_HISTORY: new SidebarAction('left', 4, state.userState),
  SIDEBAR_STYLE: new SidebarAction('right', 0, state.userState),
  SIDEBAR_INFO: new SidebarAction('right', 1, state.userState),
  SIDEBAR_DATA: new SidebarAction('right', 2, state.userState)
});

export class SidebarAction extends AbstractToggleAction {
  constructor(
    private readonly side: 'left' | 'right',
    private readonly idx: number,
    private readonly userState: UserState
  ) {
    super();

    const key = side === 'left' ? 'panelLeft' : 'panelRight';
    this.state = userState[key] === idx;

    this.userState.on('change', () => {
      const prevState = this.state;
      this.state = userState[key] === idx;
      if (this.state !== prevState) {
        this.emit('actionchanged', { action: this });
      }
    });
  }

  execute() {
    const key = this.side === 'left' ? 'panelLeft' : 'panelRight';
    if (this.userState[key] === this.idx) {
      this.userState[key] = -1;
    } else {
      this.userState[key] = this.idx;
    }
    this.emit('actiontriggered', { action: this });
  }
}
