import type { Meta, StoryObj } from '@storybook/react-vite';
import { themeDecorator } from '../.storybook/common';
import { Tabs } from './Tabs';
import { useArgs } from 'storybook/preview-api';

const meta = {
  title: 'Components/Tabs',
  component: Tabs.Root,
  parameters: {
    layout: 'centered'
  },
  argTypes: {},
  decorators: [themeDecorator()]
} satisfies Meta<typeof Tabs.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

const render = function Component(args: Story['args']) {
  const [, setArgs] = useArgs();

  const onValueChange = (value: string) => {
    args.onValueChange?.(value);
    setArgs((a: any) => ({ ...a, value: value }));
  };

  return (
    <Tabs.Root {...args} onValueChange={onValueChange}>
      {args.children}
    </Tabs.Root>
  );
};

const CHILDREN = [
  <Tabs.List key="list">
    <Tabs.Trigger value="tab1">Account</Tabs.Trigger>
    <Tabs.Trigger value="tab2">Password</Tabs.Trigger>
    <Tabs.Trigger value="tab3">Settings</Tabs.Trigger>
  </Tabs.List>,
  <Tabs.Content key="content1" value="tab1">
    <div style={{ padding: '20px' }}>
      <p>Make changes to your account here.</p>
    </div>
  </Tabs.Content>,
  <Tabs.Content key="content2" value="tab2">
    <div style={{ padding: '20px' }}>
      <p>Change your password here.</p>
    </div>
  </Tabs.Content>,
  <Tabs.Content key="content3" value="tab3">
    <div style={{ padding: '20px' }}>
      <p>Manage your settings here.</p>
    </div>
  </Tabs.Content>
];

export const Primary: Story = {
  render,
  args: {
    defaultValue: 'tab1',
    children: CHILDREN
  }
};

export const ControlledValue: Story = {
  render,
  args: {
    value: 'tab2',
    children: CHILDREN
  }
};

export const WithDisabledTab: Story = {
  render,
  args: {
    defaultValue: 'tab1',
    children: [
      <Tabs.List key="list">
        <Tabs.Trigger value="tab1">Account</Tabs.Trigger>
        <Tabs.Trigger value="tab2" disabled>
          Password
        </Tabs.Trigger>
        <Tabs.Trigger value="tab3">Settings</Tabs.Trigger>
      </Tabs.List>,
      <Tabs.Content key="content1" value="tab1">
        <div style={{ padding: '20px' }}>
          <p>Make changes to your account here.</p>
        </div>
      </Tabs.Content>,
      <Tabs.Content key="content2" value="tab2">
        <div style={{ padding: '20px' }}>
          <p>Change your password here.</p>
        </div>
      </Tabs.Content>,
      <Tabs.Content key="content3" value="tab3">
        <div style={{ padding: '20px' }}>
          <p>Manage your settings here.</p>
        </div>
      </Tabs.Content>
    ]
  }
};
