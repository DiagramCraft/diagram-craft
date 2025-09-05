import { ModelPickerTab } from './ModelPickerTab';
import { RecentShapesPickerPanel } from './RecentShapesPickerPanel';
import { ToolWindow } from '../ToolWindow';
import { ShapesPickerTab } from './ShapesPickerTab';

export const PickerToolWindow = () => {
  return (
    <ToolWindow.Root id={'picker'} defaultTab={'picker'}>
      <ToolWindow.Tab id={'picker'} title={'Shapes'}>
        <ShapesPickerTab />
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'recent'} title={'Recent'}>
        <ToolWindow.TabContent>
          <RecentShapesPickerPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
      <ToolWindow.Tab id={'model'} title={'Model'}>
        <ModelPickerTab />
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
