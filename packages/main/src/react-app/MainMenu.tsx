import { urlToName } from '@diagram-craft/utils/url';
import { $t, type TranslatedString } from '@diagram-craft/utils/localize';
import { Application, useApplication } from '../application';
import { mainMenuStructure } from './mainMenuData';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import type { UserState } from '../UserState';
import { Menu } from '@diagram-craft/app-components/Menu';
import { HamburgerMenu } from '@diagram-craft/app-components/HamburgerMenu';
import { ActionMenuItem } from './components/ActionMenuItem';
import { ActionToggleMenuItem } from './components/ActionToggleMenuItem';

const getLabel = (label: string | TranslatedString) =>
  typeof label === 'string' ? label : $t(label);

const renderMenuItem = (item: MenuEntry, application: Application, userState: UserState) => {
  const label = getLabel(item.label);

  if (item.type === 'separator') {
    return <Menu.Separator key={label} />;
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
      <Menu.SubMenu key={label} label={label} disabled={isDisabled}>
        {submenuItems.map(subItem => {
          if (item.id === 'recent') {
            return (
              <Menu.Item
                key={subItem.action}
                onClick={() => application.file.loadDocument(subItem.action!)}
              >
                {getLabel(subItem.label)}
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
      <ActionToggleMenuItem key={label} action={item.action} arg={{}}>
        {label}
      </ActionToggleMenuItem>
    );
  }

  if (item.action) {
    return <ActionMenuItem key={label} action={item.action} arg={{}} />;
  }

  return <div key={label}>{label}</div>;
};

export const MainMenu = () => {
  const application = useApplication();
  const userState = application.userState;

  return (
    <HamburgerMenu>
      {mainMenuStructure.map(item => renderMenuItem(item, application, userState))}
    </HamburgerMenu>
  );
};
