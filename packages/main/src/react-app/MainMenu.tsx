import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { TbChevronRight, TbMenu2 } from 'react-icons/tb';
import { ActionDropdownMenuItem } from './components/ActionDropdownMenuItem';
import { urlToName } from '@diagram-craft/utils/url';
import { ToggleActionDropdownMenuItem } from './components/ToggleActionDropdownMenuItem';
import { useApplication } from '../application';
import { UserState } from '../UserState';

type Props = {
  userState: UserState;
};

export const MainMenu = ({ userState }: Props) => {
  const application = useApplication();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className={'_menu-button'}>
          <TbMenu2 size={'24px'} />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="cmp-context-menu" sideOffset={2} align={'start'}>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="cmp-context-menu__sub-trigger">
              File
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
                <ActionDropdownMenuItem action={'FILE_NEW'}>New</ActionDropdownMenuItem>
                <ActionDropdownMenuItem action={'FILE_OPEN'}>Open...</ActionDropdownMenuItem>

                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger
                    className="cmp-context-menu__sub-trigger"
                    disabled={
                      userState.recentFiles.filter(
                        url => url !== application.model.activeDocument.url
                      ).length === 0
                    }
                  >
                    Open Recent...
                    <div className="cmp-context-menu__right-slot">
                      <TbChevronRight />
                    </div>
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      className="cmp-context-menu"
                      sideOffset={2}
                      alignOffset={-5}
                    >
                      {userState.recentFiles
                        .filter(url => url !== application.model.activeDocument.url)
                        .map(url => (
                          <DropdownMenu.Item
                            key={url}
                            className="cmp-context-menu__item"
                            onSelect={() => application.file.loadDocument(url)}
                          >
                            {urlToName(url)}
                          </DropdownMenu.Item>
                        ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
                <ActionDropdownMenuItem action={'FILE_SAVE'}>Save</ActionDropdownMenuItem>
                <ActionDropdownMenuItem action={'FILE_SAVE'}>Save As...</ActionDropdownMenuItem>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="cmp-context-menu__sub-trigger">
              Edit
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
                <ActionDropdownMenuItem action={'UNDO'}>Undo</ActionDropdownMenuItem>
                <ActionDropdownMenuItem action={'REDO'}>Redo</ActionDropdownMenuItem>
                <DropdownMenu.Separator className="cmp-context-menu__separator" />

                <ActionDropdownMenuItem action={'CLIPBOARD_CUT'}>Cut</ActionDropdownMenuItem>
                <ActionDropdownMenuItem action={'CLIPBOARD_COPY'}>Copy</ActionDropdownMenuItem>
                <ActionDropdownMenuItem action={'DUPLICATE'}>Duplicate</ActionDropdownMenuItem>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="cmp-context-menu__sub-trigger">
              View
              <div className="cmp-context-menu__right-slot">
                <TbChevronRight />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="cmp-context-menu" sideOffset={2} alignOffset={-5}>
                <ActionDropdownMenuItem action={'ZOOM_IN'}>Zoom In</ActionDropdownMenuItem>
                <ActionDropdownMenuItem action={'ZOOM_OUT'}>Zoom Out</ActionDropdownMenuItem>
                <DropdownMenu.Separator className="cmp-context-menu__separator" />
                <ToggleActionDropdownMenuItem action={'TOGGLE_RULER'}>
                  Ruler
                </ToggleActionDropdownMenuItem>
                <ToggleActionDropdownMenuItem action={'TOGGLE_HELP'}>
                  Help
                </ToggleActionDropdownMenuItem>
                <ToggleActionDropdownMenuItem action={'TOGGLE_DARK_MODE'}>
                  Dark Mode
                </ToggleActionDropdownMenuItem>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
