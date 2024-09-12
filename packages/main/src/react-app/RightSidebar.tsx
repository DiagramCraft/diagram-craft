import { SideBar, SideBarPage } from './SideBar';
import { TbDatabaseEdit, TbInfoCircle, TbPalette } from 'react-icons/tb';
import { ObjectToolWindow } from './toolwindow/ObjectToolWindow/ObjectToolWindow';
import { ObjectInfoToolWindow } from './toolwindow/ObjectInfoToolWindow/ObjectInfoToolWindow';
import { ObjectDataToolWindow } from './toolwindow/ObjectDataToolWindow/ObjectDataToolWindow';

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
    </SideBar>
  );
};
