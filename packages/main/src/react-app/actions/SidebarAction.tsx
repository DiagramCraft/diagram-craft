import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';
import { UserState } from '../../UserState';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof sidebarActions> {}
  }
}

export const sidebarActions = (context: ActionContext) => ({
  SIDEBAR_SHAPES: new SidebarAction('left', 0, context),
  SIDEBAR_LAYERS: new SidebarAction('left', 1, context),
  SIDEBAR_SELECT: new SidebarAction('left', 2, context),
  SIDEBAR_DOCUMENT: new SidebarAction('left', 3, context),
  SIDEBAR_HISTORY: new SidebarAction('left', 4, context),
  SIDEBAR_STYLE: new SidebarAction('right', 0, context),
  SIDEBAR_INFO: new SidebarAction('right', 1, context),
  SIDEBAR_DATA: new SidebarAction('right', 2, context)
});

const SIDEBAR_NAME_MAP: Record<string, string> = {
  'left-0': 'Shapes Panel',
  'left-1': 'Layers Panel',
  'left-2': 'Select Panel',
  'left-3': 'Document Panel',
  'left-4': 'History Panel',
  'right-0': 'Style Panel',
  'right-1': 'Info Panel',
  'right-2': 'Data Panel'
};

export class SidebarAction extends AbstractToggleAction {
  name: string;
  private readonly userState: UserState;

  constructor(
    private readonly side: 'left' | 'right',
    private readonly idx: number,
    context: ActionContext
  ) {
    super(context);

    this.name = SIDEBAR_NAME_MAP[`${side}-${idx}`] ?? `${side} Panel ${idx}`;
    this.userState = UserState.get();

    const key = side === 'left' ? 'panelLeft' : 'panelRight';
    this.state = this.userState[key] === idx;

    this.userState.on('change', () => {
      const prevState = this.state;
      this.state = this.userState[key] === idx;
      if (this.state !== prevState) {
        this.emit('actionChanged');
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
    this.emit('actionTriggered', {});
  }
}
