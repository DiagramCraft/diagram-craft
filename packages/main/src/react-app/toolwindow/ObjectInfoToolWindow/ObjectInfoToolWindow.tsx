import { ObjectInfoPanel } from './ObjectInfoPanel';
import { ToolWindow } from '../ToolWindow';

export const ObjectInfoToolWindow = () => {
  return (
    <ToolWindow.Root defaultTab={'object'}>
      <ToolWindow.Tab id={'object'} title={'Selection Info'}>
        <ToolWindow.TabContent>
          <ObjectInfoPanel />
        </ToolWindow.TabContent>
      </ToolWindow.Tab>
    </ToolWindow.Root>
  );
};
