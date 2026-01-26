import { AbstractToggleAction, ActionContext } from '@diagram-craft/canvas/action';
import { UserState } from '../../UserState';
import { $tStr, type TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof sidebarActions> {}
  }
}

export const sidebarActions = (context: ActionContext) => ({
  SIDEBAR_OBJECTS: new SidebarAction(
    'left',
    0,
    $tStr('action.SIDEBAR_OBJECTS.name', 'Object Panel'),
    context
  ),
  SIDEBAR_STRUCTURE: new SidebarAction(
    'left',
    1,
    $tStr('action.SIDEBAR_STRUCTURE.name', 'Structure Panel'),
    context
  ),
  SIDEBAR_HISTORY: new SidebarAction(
    'left',
    2,
    $tStr('action.SIDEBAR_HISTORY.name', 'History Panel'),
    context
  ),
  SIDEBAR_SEARCH: new SidebarAction(
    'left',
    3,
    $tStr('action.SIDEBAR_SEARCH.name', 'Search Panel'),
    context
  ),
  SIDEBAR_STORY_PLAYER: new SidebarAction(
    'left',
    4,
    $tStr('action.SIDEBAR_STORY_PLAYER.name', 'Story Player Panel'),
    context
  ),
  SIDEBAR_DIAGRAM_CODE: new SidebarAction(
    'left',
    5,
    $tStr('action.SIDEBAR_DIAGRAM_CODE.name', 'Diagram as Code Panel'),
    context
  ),
  SIDEBAR_AI: new SidebarAction('left', 6, $tStr('action.SIDEBAR_AI.name', 'AI Panel'), context),
  SIDEBAR_STYLE: new SidebarAction(
    'right',
    0,
    $tStr('action.SIDEBAR_STYLE.name', 'Style Panel'),
    context
  ),
  SIDEBAR_INFO: new SidebarAction(
    'right',
    1,
    $tStr('action.SIDEBAR_INFO.name', 'Info Panel'),
    context
  ),
  SIDEBAR_DATA: new SidebarAction(
    'right',
    2,
    $tStr('action.SIDEBAR_DATA.name', 'Data Panel'),
    context
  ),
  SIDEBAR_COMMENT: new SidebarAction(
    'right',
    3,
    $tStr('action.SIDEBAR_COMMENT.name', 'Comments Panel'),
    context
  ),
  SIDEBAR_STYLE_OVERVIEW: new SidebarAction(
    'right',
    4,
    $tStr('action.SIDEBAR_STYLE_OVERVIEW.name', 'Style Overview Panel'),
    context
  )
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
