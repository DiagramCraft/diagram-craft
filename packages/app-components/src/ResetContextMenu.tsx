import * as ContextMenu from '@radix-ui/react-context-menu';
import { usePortal } from './PortalContext';

export const ResetContextMenu = (props: Props) => {
  const portal = usePortal();
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild={true} {...props}>
        {props.children}
      </ContextMenu.Trigger>

      <ContextMenu.Portal container={portal}>
        <ContextMenu.Content className="cmp-context-menu">
          <ContextMenu.Item className={'cmp-context-menu__item'} onClick={props.onReset}>
            Reset
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

type Props = {
  disabled?: boolean;
  onReset: () => void;
  children: React.ReactNode;
};
