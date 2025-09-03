import { SideBar, SideBarPage } from './SideBar';
import { TbDatabaseSearch, TbHistory, TbPentagonPlus, TbSearch, TbStack } from 'react-icons/tb';
import { PickerToolWindow } from './toolwindow/PickerToolWindow/PickerToolWindow';
import { LayerToolWindow } from './toolwindow/LayerToolWindow/LayerToolWindow';
import { HistoryToolWindow } from './toolwindow/HistoryToolWindow/HistoryToolWindow';
import { QueryToolWindow } from './toolwindow/QueryToolWindow/QueryToolWindow';
import { DataToolWindow } from './toolwindow/DataToolWindow/DataToolWindow';

export const LeftSidebar = () => {
  return (
    <SideBar side={'left'}>
      <SideBarPage icon={TbPentagonPlus}>
        <PickerToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbStack}>
        <LayerToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbHistory}>
        <HistoryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbSearch}>
        <QueryToolWindow />
      </SideBarPage>
      <SideBarPage icon={TbDatabaseSearch}>
        <DataToolWindow />
      </SideBarPage>
    </SideBar>
  );
};
