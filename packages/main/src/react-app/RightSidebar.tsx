import { SideBar, SideBarPage } from './SideBar';
import { TbBadge, TbDatabaseEdit, TbInfoCircle, TbPalette } from 'react-icons/tb';
import { ObjectToolWindow } from './toolwindow/ObjectToolWindow/ObjectToolWindow';
import { ObjectInfoToolWindow } from './toolwindow/ObjectInfoToolWindow/ObjectInfoToolWindow';
import { ObjectDataToolWindow } from './toolwindow/ObjectDataToolWindow/ObjectDataToolWindow';
import { ObjectIndicatorToolWindow } from './toolwindow/ObjectIndicatorToolWindow/ObjectIndicatorToolWindow';

export const RightSidebar = () => {
  return (
    <SideBar side={'right'}>
      <SideBarPage icon={TbPalette}>
        <ObjectToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbInfoCircle}>
        <ObjectInfoToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbDatabaseEdit}>
        <ObjectDataToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbBadge}>
        <ObjectIndicatorToolWindow />
      </SideBarPage>
    </SideBar>
  );
};
