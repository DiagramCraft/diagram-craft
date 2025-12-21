import { ToolWindow } from '../ToolWindow';
import { StylesTab } from './StylesTab';
import { StylesheetsTab } from './StylesheetsTab';

export const StyleOverviewToolWindow = () => {
  return (
    <ToolWindow.Root id={'style-overview'} defaultTab={'stylesheets'}>
      <ToolWindow.Tab title={'Stylesheets'} id={'stylesheets'}>
        <StylesheetsTab />
      </ToolWindow.Tab>
      <ToolWindow.Tab title={'Styles'} id={'styles'}>
        <StylesTab />
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
