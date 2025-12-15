import type { Meta, StoryObj } from '@storybook/react-vite';
import styles from './Menu.module.css';
import { Menu } from './Menu';
import { Menu as BaseUIMenu } from '@base-ui-components/react/menu';
import { PortalContextProvider, usePortal } from './PortalContext';
import { TbCircle, TbEye, TbLock, TbRectangle } from 'react-icons/tb';

export const decorator = () => {
  // @ts-ignore
  return Story => (
    <div style={{ fontSize: '11px' }}>
      <div
        style={{
          width: '100vw',
          height: '90vh',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)'
        }}
      >
        <div
          className={'dark-theme'}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--panel-bg)',
            color: 'var(--panel-fg)'
          }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'dark-theme'}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--base-bg)',
            color: 'var(--base-fg)'
          }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'light-theme'}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--panel-bg)',
            color: 'var(--panel-fg)'
          }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
        <div
          className={'light-theme'}
          style={{
            padding: '1rem',
            backgroundColor: 'var(--base-bg)',
            color: 'var(--base-fg)'
          }}
        >
          <PortalContextProvider>
            <Story />
          </PortalContextProvider>
        </div>
      </div>
    </div>
  );
};

const MenuRoot = () => {
  const portal = usePortal();
  return (
    <Menu.Context type={'context'}>
      <BaseUIMenu.Root open={true}>
        <BaseUIMenu.Trigger
          style={{ color: 'transparent', width: '100%', background: 'transparent' }}
        >
          Trigger
        </BaseUIMenu.Trigger>
        <BaseUIMenu.Portal container={portal}>
          <BaseUIMenu.Positioner>
            <BaseUIMenu.Popup className={styles.cmpMenu}>
              <Menu.Item>Basic</Menu.Item>
              <Menu.Item rightSlot={'Ctrl-X'}>With keybinding</Menu.Item>
              <Menu.Item rightSlot={<TbEye />}>With right icon</Menu.Item>
              <Menu.Item
                rightSlot={
                  <span style={{ color: 'var(--error-fg)' }}>
                    <TbLock />
                  </span>
                }
              >
                With right color icon
              </Menu.Item>
              <Menu.Item leftSlot={<TbCircle />}>With indicator</Menu.Item>
              <Menu.Item disabled={true}>Disabled</Menu.Item>
              <Menu.Separator />
              <Menu.SubMenu label={'Submenu'}>
                <Menu.Item>Item 1</Menu.Item>
                <Menu.Item>Item 2</Menu.Item>
                <Menu.Item>Item 3</Menu.Item>
              </Menu.SubMenu>
              <Menu.SubMenu label={'Submenu disabled'} disabled={true}>
                <Menu.Item>Item 1</Menu.Item>
                <Menu.Item>Item 2</Menu.Item>
                <Menu.Item>Item 3</Menu.Item>
              </Menu.SubMenu>
              <Menu.SubMenu label={'Submenu icon'} leftSlot={<TbRectangle />}>
                <Menu.Item>Item 1</Menu.Item>
                <Menu.Item>Item 2</Menu.Item>
                <Menu.Item>Item 3</Menu.Item>
              </Menu.SubMenu>
              <Menu.Separator />
              <Menu.RadioGroup value={'item2'}>
                <Menu.RadioItem value={'item1'}>Item 1</Menu.RadioItem>
                <Menu.RadioItem value={'item2'}>Item 2</Menu.RadioItem>
                <Menu.RadioItem value={'item3'}>Item 3</Menu.RadioItem>
                <Menu.RadioItem value={'item4'} disabled={true}>
                  Item 4
                </Menu.RadioItem>
              </Menu.RadioGroup>
              <Menu.Separator />
              <Menu.CheckboxItem checked={true}>Checked</Menu.CheckboxItem>
              <Menu.CheckboxItem checked={false}>Unchecked</Menu.CheckboxItem>
              <Menu.CheckboxItem checked={false} disabled={true}>
                Unchecked disabled
              </Menu.CheckboxItem>
            </BaseUIMenu.Popup>
          </BaseUIMenu.Positioner>
        </BaseUIMenu.Portal>
      </BaseUIMenu.Root>
    </Menu.Context>
  );
};

const meta = {
  title: 'Components/Menu',
  component: MenuRoot,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [decorator()]
} satisfies Meta<typeof MenuRoot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {}
};
