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
import { useApplication } from '../application';
import { $t } from '@diagram-craft/utils/localize';

export const RightSidebar = () => {
  const app = useApplication();
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
      <SideBarPage icon={TbPalette} tooltip={$t(app.actions['SIDEBAR_STYLE']!.name)}>
        <ObjectToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbInfoCircle} tooltip={$t(app.actions['SIDEBAR_INFO']!.name)}>
        <ObjectInfoToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbDatabaseEdit} tooltip={$t(app.actions['SIDEBAR_DATA']!.name)}>
        <ObjectDataToolWindow />
      </SideBarPage>
      <SideBarPage
        icon={TbMessageCircle}
        extra={<CommentsToolWindowBadge />}
        tooltip={$t(app.actions['SIDEBAR_COMMENT']!.name)}
      >
        <CommentsToolWindow />
      </SideBarPage>
    </SideBar>
  );
};
