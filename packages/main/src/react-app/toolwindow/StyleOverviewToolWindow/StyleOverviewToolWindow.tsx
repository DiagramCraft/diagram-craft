import { ToolWindow } from '../ToolWindow';
import { FontsTab } from './FontsTab';

export const StyleOverviewToolWindow = () => {
  return (
    <ToolWindow.Root id={'style-overview'} defaultTab={'fonts'}>
      <ToolWindow.Tab title={'Fonts'} id={'fonts'}>
        <FontsTab />
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
