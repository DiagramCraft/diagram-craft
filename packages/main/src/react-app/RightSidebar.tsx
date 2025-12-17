import { SideBar, SideBarBottomToolbar, SideBarPage } from './SideBar';
import {
  TbDatabaseEdit,
  TbHelpSquare,
  TbInfoCircle,
  TbMessageCircle,
  TbPalette
} from 'react-icons/tb';
import { ObjectToolWindow } from './toolwindow/ObjectToolWindow/ObjectToolWindow';
import { ObjectInfoToolWindow } from './toolwindow/ObjectInfoToolWindow/ObjectInfoToolWindow';
import { ObjectDataToolWindow } from './toolwindow/ObjectDataToolWindow/ObjectDataToolWindow';
import { CommentsToolWindow } from './toolwindow/CommentsToolWindow/CommentsToolWindow';
import { ActionToggleButton } from './toolbar/ActionToggleButton';
import { CommentsToolWindowBadge } from './toolwindow/CommentsToolWindow/CommentsToolWindowBadge';
import { ActionTooltip } from './components/ActionTooltip';

export const RightSidebar = () => {
  return (
    <SideBar
      side={'right'}
      bottom={
        <SideBarBottomToolbar>
          <ActionToggleButton action={'TOGGLE_HELP'}>
            <TbHelpSquare size={'17.5px'} />
          </ActionToggleButton>
        </SideBarBottomToolbar>
      }
    >
      <SideBarPage icon={TbPalette} tooltip={<ActionTooltip action={'SIDEBAR_STYLE'} />}>
        <ObjectToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbInfoCircle} tooltip={<ActionTooltip action={'SIDEBAR_INFO'} />}>
        <ObjectInfoToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbDatabaseEdit} tooltip={<ActionTooltip action={'SIDEBAR_DATA'} />}>
        <ObjectDataToolWindow />
      </SideBarPage>
      <SideBarPage
        icon={TbMessageCircle}
        extra={<CommentsToolWindowBadge />}
        tooltip={<ActionTooltip action={'SIDEBAR_COMMENT'} />}
      >
        <CommentsToolWindow />
      </SideBarPage>
    </SideBar>
  );
};
