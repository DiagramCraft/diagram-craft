import type React from 'react';
import { TbLayoutNavbar } from 'react-icons/tb';
import { defineMdxComponent } from '../../defineMdxComponent';
import { Tabs } from './Tabs';
import { TAB_TYPE } from './TabEditable';
import { TABS_TYPE, TabsEditable, tabsMdxRule } from './TabsEditable';
import type { TabsSlateElement } from './types';

export const tabsSpec = defineMdxComponent<
  TabsSlateElement,
  { children?: React.ReactNode },
  'block'
>({
  component: Tabs,
  mode: 'block',
  allowedProps: [],
  acceptsRichContent: true,
  editorSpec: {
    editableComponent: TabsEditable,
    nodeOptions: {},
    mdxRule: tabsMdxRule,
    slashCommand: {
      key: 'tabs',
      label: 'Tabs',
      description: 'Present alternative content under selectable tabs',
      icon: <TbLayoutNavbar size={14} />,
      keywords: ['tabs', 'tab', 'switch', 'toggle'],
      onSelect: (editor, { insertOrReplaceBlock }) => {
        insertOrReplaceBlock(editor, {
          type: TABS_TYPE,
          children: [
            { type: TAB_TYPE, label: '', children: [{ type: 'p', children: [{ text: '' }] }] },
            { type: TAB_TYPE, label: '', children: [{ type: 'p', children: [{ text: '' }] }] }
          ]
        });
      }
    }
  }
});
