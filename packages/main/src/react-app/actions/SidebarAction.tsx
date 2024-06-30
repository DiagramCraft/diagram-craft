import { ActionMapFactory, AppState } from '@diagram-craft/canvas/keyMap';
import { AbstractToggleAction } from '@diagram-craft/canvas/action';
import { UserState } from '@diagram-craft/canvas/UserState';

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

export const sidebarActions: ActionMapFactory = (_state: AppState) => ({
  SIDEBAR_SHAPES: new SidebarAction('left', 0),
  SIDEBAR_LAYERS: new SidebarAction('left', 1),
  SIDEBAR_SELECT: new SidebarAction('left', 2),
  SIDEBAR_DOCUMENT: new SidebarAction('left', 3),
  SIDEBAR_HISTORY: new SidebarAction('left', 4),
  SIDEBAR_STYLE: new SidebarAction('right', 0),
  SIDEBAR_INFO: new SidebarAction('right', 1),
  SIDEBAR_DATA: new SidebarAction('right', 2)
});

export class SidebarAction extends AbstractToggleAction {
  private userState: UserState;

  constructor(
    private readonly side: 'left' | 'right',
    private readonly idx: number
  ) {
    super();

    this.userState = UserState.get();

    const key = side === 'left' ? 'panelLeft' : 'panelRight';
    this.state = this.userState[key] === idx;

    this.userState.on('change', () => {
      const prevState = this.state;
      this.state = this.userState[key] === idx;
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
