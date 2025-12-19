import { ToolWindow } from '../ToolWindow';
import { StylesTab } from './StylesTab';

export const StyleOverviewToolWindow = () => {
  return (
    <ToolWindow.Root id={'style-overview'} defaultTab={'styles'}>
      <ToolWindow.Tab title={'Styles'} id={'styles'}>
        <StylesTab />
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
