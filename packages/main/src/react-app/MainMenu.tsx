import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TbChevronRight, TbMenu2 } from 'react-icons/tb';
import { ActionDropdownMenuItem } from './components/ActionDropdownMenuItem';
import { urlToName } from '@diagram-craft/utils/url';
import { ToggleActionDropdownMenuItem } from './components/ToggleActionDropdownMenuItem';
import { Application, useApplication } from '../application';
import { mainMenuStructure } from './mainMenuData';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';
import type { UserState } from '../UserState';

const renderMenuItem = (
  item: MenuEntry,
  application: Application,
  userState: UserState
): JSX.Element => {
  if (item.type === 'separator') {
    return <DropdownMenu.Separator key={item.label} className="cmp-context-menu__separator" />;
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
      <DropdownMenu.Sub key={item.label}>
        <DropdownMenu.SubTrigger className="cmp-context-menu__sub-trigger" disabled={isDisabled}>
          {item.label}
          <div className="cmp-context-menu__right-slot">
            <TbChevronRight />
          </div>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
            {submenuItems.map(subItem => {
              if (item.label === 'Open Recent...') {
                return (
                  <DropdownMenu.Item
                    key={subItem.action}
                    className="cmp-context-menu__item"
                    onSelect={() => application.file.loadDocument(subItem.action!)}
                  >
                    {subItem.label}
                  </DropdownMenu.Item>
                );
              }
              return renderMenuItem(subItem, application, userState);
            })}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={'_menu-button'} id={'main-menu'} type="button">
          <TbMenu2 size={'24px'} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cmp-context-menu" sideOffset={2} align={'start'}>
          {mainMenuStructure.map(item => renderMenuItem(item, application, userState))}
          <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
