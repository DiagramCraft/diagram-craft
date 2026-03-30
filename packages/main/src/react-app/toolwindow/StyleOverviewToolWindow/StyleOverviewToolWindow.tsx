import { ToolWindow } from '../ToolWindow';
import { StylesTab } from './StylesTab';
import { StylesheetsTab } from './StylesheetsTab';
import { StyleVariantsTab } from './StyleVariantsTab';

export const StyleOverviewToolWindow = () => {
  return (
    <ToolWindow.Root id={'style-overview'} defaultTab={'stylesheets'}>
      <ToolWindow.Tab title={'Stylesheets'} id={'stylesheets'}>
        <StylesheetsTab />
      </ToolWindow.Tab>
      <ToolWindow.Tab title={'Styles'} id={'styles'}>
        <StylesTab />
      </ToolWindow.Tab>
      <ToolWindow.Tab title={'Variants'} id={'variants'}>
        <StyleVariantsTab />
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
