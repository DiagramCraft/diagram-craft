import { TbChevronRight, TbMenu2 } from 'react-icons/tb';
import { ActionDropdownMenuItem } from './components/ActionDropdownMenuItem';
import { urlToName } from '@diagram-craft/utils/url';
import { ToggleActionDropdownMenuItem } from './components/ToggleActionDropdownMenuItem';
import { Application, useApplication } from '../application';
import { mainMenuStructure } from './mainMenuData';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import type { UserState } from '../UserState';
import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';

const renderMenuItem = (
  item: MenuEntry,
  application: Application,
  userState: UserState
): JSX.Element => {
  if (item.type === 'separator') {
    return <BaseUIMenu.Separator key={item.label} className="cmp-context-menu__separator" />;
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
      <BaseUIMenu.SubmenuRoot key={item.label}>
        <BaseUIMenu.SubmenuTrigger className="cmp-context-menu__sub-trigger" disabled={isDisabled}>
          {item.label}
          <div className="cmp-context-menu__right-slot">
            <TbChevronRight />
          </div>
        </BaseUIMenu.SubmenuTrigger>
        <BaseUIMenu.Portal>
          <BaseUIMenu.Positioner sideOffset={2} alignOffset={-5}>
            <BaseUIMenu.Popup className="cmp-context-menu">
              {submenuItems.map(subItem => {
                if (item.label === 'Open Recent...') {
                  return (
                    <BaseUIMenu.Item
                      key={subItem.action}
                      className="cmp-context-menu__item"
                      onSelect={() => application.file.loadDocument(subItem.action!)}
                    >
                      {subItem.label}
                    </BaseUIMenu.Item>
                  );
                }
                return renderMenuItem(subItem, application, userState);
              })}
            </BaseUIMenu.Popup>
          </BaseUIMenu.Positioner>
        </BaseUIMenu.Portal>
      </BaseUIMenu.SubmenuRoot>
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
    <BaseUIMenu.Root>
      <BaseUIMenu.Trigger className={'_menu-button'} id={'main-menu'} type="button">
        <TbMenu2 size={'24px'} />
      </BaseUIMenu.Trigger>

      <BaseUIMenu.Portal>
        <BaseUIMenu.Positioner sideOffset={2} align={'start'}>
          <BaseUIMenu.Popup className="cmp-context-menu">
            {mainMenuStructure.map(item => renderMenuItem(item, application, userState))}
            <BaseUIMenu.Arrow className="cmp-context-menu__arrow" />
          </BaseUIMenu.Popup>
        </BaseUIMenu.Positioner>
      </BaseUIMenu.Portal>
    </BaseUIMenu.Root>
  );
};
