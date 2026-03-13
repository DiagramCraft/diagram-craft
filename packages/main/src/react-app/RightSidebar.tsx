import { Sidebar, SidebarBottomToolbar, SidebarPage } from './Sidebar';
import {
  TbDatabaseEdit,
  TbHelpSquare,
  TbInfoCircle,
  TbListDetails,
  TbMessageCircle,
  TbPalette
} from 'react-icons/tb';
import { ObjectToolWindow } from './toolwindow/ObjectToolWindow/ObjectToolWindow';
import { ObjectInfoToolWindow } from './toolwindow/ObjectInfoToolWindow/ObjectInfoToolWindow';
import { ObjectDataToolWindow } from './toolwindow/ObjectDataToolWindow/ObjectDataToolWindow';
import { CommentsToolWindow } from './toolwindow/CommentsToolWindow/CommentsToolWindow';
import { StyleOverviewToolWindow } from './toolwindow/StyleOverviewToolWindow/StyleOverviewToolWindow';
import { ActionToggleButton } from './toolbar/ActionToggleButton';
import { CommentsToolWindowBadge } from './toolwindow/CommentsToolWindow/CommentsToolWindowBadge';
import { ActionTooltip } from './components/ActionTooltip';

export const RightSidebar = () => {
  return (
    <Sidebar
      id={'right-sidebar'}
      side={'right'}
      bottom={
        <SidebarBottomToolbar>
          <ActionToggleButton action={'TOGGLE_HELP'}>
            <TbHelpSquare size={'17.5px'} />
          </ActionToggleButton>
        </SidebarBottomToolbar>
      }
    >
      <SidebarPage icon={TbPalette} tooltip={<ActionTooltip action={'SIDEBAR_STYLE'} />}>
        <ObjectToolWindow />
      </SidebarPage>
      <SidebarPage icon={TbInfoCircle} tooltip={<ActionTooltip action={'SIDEBAR_INFO'} />}>
        <ObjectInfoToolWindow />
      </SidebarPage>
      <SidebarPage icon={TbDatabaseEdit} tooltip={<ActionTooltip action={'SIDEBAR_DATA'} />}>
        <ObjectDataToolWindow />
      </SidebarPage>
      <SidebarPage
        icon={TbMessageCircle}
        extra={<CommentsToolWindowBadge />}
        tooltip={<ActionTooltip action={'SIDEBAR_COMMENT'} />}
      >
        <CommentsToolWindow />
      </SidebarPage>
      <SidebarPage
        icon={TbListDetails}
        tooltip={<ActionTooltip action={'SIDEBAR_STYLE_OVERVIEW'} />}
      >
        <StyleOverviewToolWindow />
      </SidebarPage>
    </Sidebar>
  );
};
