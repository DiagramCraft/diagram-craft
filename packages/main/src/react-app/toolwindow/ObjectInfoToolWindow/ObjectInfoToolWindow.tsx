import { ObjectInfoPanel } from './ObjectInfoPanel';
import { ToolWindow } from '../ToolWindow';

export const ObjectInfoToolWindow = () => {
  return (
    <ToolWindow.Root id={'object-info'} defaultTab={'object'}>
      <ToolWindow.Tab id={'object'} title={'Selection Info'}>
        <ToolWindow.TabContent>
          <ObjectInfoPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
