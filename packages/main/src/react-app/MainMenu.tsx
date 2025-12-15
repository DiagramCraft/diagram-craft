import { TbMenu2 } from 'react-icons/tb';
import { ActionDropdownMenuItem } from './components/ActionDropdownMenuItem';
import { urlToName } from '@diagram-craft/utils/url';
import { ToggleActionDropdownMenuItem } from './components/ToggleActionDropdownMenuItem';
import { Application, useApplication } from '../application';
import { mainMenuStructure } from './mainMenuData';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import type { UserState } from '../UserState';
import { Menu } from '@diagram-craft/app-components/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';

const renderMenuItem = (
  item: MenuEntry,
  application: Application,
  userState: UserState
): JSX.Element => {
  if (item.type === 'separator') {
    return <Menu.Separator key={item.label} />;
  }

  if (item.type === 'submenu' || item.type === 'recent') {
    let isDisabled = item.disabled ?? false;
    let submenuItems = item.submenu ?? [];

    if (item.type === 'recent') {
      const recentFiles = userState.recentFiles.filter(
        (url: string) => url !== application.model.activeDocument.url
      );
      isDisabled = recentFiles.length === 0;
      submenuItems = recentFiles.map((url: string) => ({
        id: url,
        label: urlToName(url),
        type: 'action' as const,
        action: url
      }));
    }

    return (
      <Menu.SubMenu key={item.label} label={item.label} disabled={isDisabled}>
        {submenuItems.map(subItem => {
          if (item.label === 'Open Recent...') {
            return (
              <Menu.Item
                key={subItem.action}
                onClick={() => application.file.loadDocument(subItem.action!)}
              >
                {subItem.label}
              </Menu.Item>
            );
          }
          return renderMenuItem(subItem, application, userState);
        })}
      </Menu.SubMenu>
    );
  }

  if (item.type === 'toggle' && item.action) {
    return (
      <ToggleActionDropdownMenuItem key={item.label} action={item.action} arg={{}}>
        {item.label}
      </ToggleActionDropdownMenuItem>
    );
  }

  if (item.action) {
    return (
      <ActionDropdownMenuItem key={item.label} action={item.action} arg={{}}>
        {item.label}
      </ActionDropdownMenuItem>
    );
  }

  return <div key={item.label}>{item.label}</div>;
};

export const MainMenu = () => {
  const application = useApplication();
  const userState = application.userState;

  return (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={
          <button id={'main-menu'} type={'button'} className={'_menu-button'}>
            <TbMenu2 size={'24px'} />
          </button>
        }
      />

      <MenuButton.Menu>
        {mainMenuStructure.map(item => renderMenuItem(item, application, userState))}
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
