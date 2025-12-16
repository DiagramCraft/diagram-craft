import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';
import { UserState } from '../../UserState';
import { $tStr, type TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof sidebarActions> {}
  }
}

export const sidebarActions = (context: ActionContext) => ({
  SIDEBAR_SHAPES: new SidebarAction(
    'left',
    0,
    $tStr('action.SIDEBAR_SHAPES', 'Shapes Panel'),
    context
  ),
  SIDEBAR_LAYERS: new SidebarAction(
    'left',
    1,
    $tStr('action.SIDEBAR_LAYERS', 'Layers Panel'),
    context
  ),
  SIDEBAR_SELECT: new SidebarAction(
    'left',
    2,
    $tStr('action.SIDEBAR_SELECT', 'Select Panel'),
    context
  ),
  SIDEBAR_DOCUMENT: new SidebarAction(
    'left',
    3,
    $tStr('action.SIDEBAR_DOCUMENT', 'Document Panel'),
    context
  ),
  SIDEBAR_HISTORY: new SidebarAction(
    'left',
    4,
    $tStr('action.SIDEBAR_HISTORY', 'History Panel'),
    context
  ),
  SIDEBAR_STYLE: new SidebarAction(
    'right',
    0,
    $tStr('action.SIDEBAR_STYLE', 'Sidebar Panel'),
    context
  ),
  SIDEBAR_INFO: new SidebarAction('right', 1, $tStr('action.SIDEBAR_INFO', 'Info Panel'), context),
  SIDEBAR_DATA: new SidebarAction('right', 2, $tStr('action.SIDEBAR_DATA', 'Data Panel'), context)
});

export class SidebarAction extends AbstractToggleAction {
  private readonly userState: UserState;

  constructor(
    private readonly side: 'left' | 'right',
    private readonly idx: number,
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context);

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
