import { ToolWindow } from '../ToolWindow';
import { FontsTab } from './FontsTab';
import { ColorsTab } from './ColorsTab';

export const StyleOverviewToolWindow = () => {
  return (
    <ToolWindow.Root id={'style-overview'} defaultTab={'fonts'}>
      <ToolWindow.Tab title={'Fonts'} id={'fonts'}>
        <FontsTab />
      </ToolWindow.Tab>
      <ToolWindow.Tab title={'Colors'} id={'colors'}>
        <ColorsTab />
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
