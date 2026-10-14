import type React from 'react';
import { defineComponent } from '../../defineComponent';
import { Tab } from './Tab';
import { TAB_TYPE } from './TabEditable';
import { TabEditable, tabMdxRule } from './TabEditable';
import type { TabSlateElement } from './types';

export const tabSpec = defineComponent<
  TabSlateElement,
  { label?: string; children?: React.ReactNode },
  'block'
>({
  type: TAB_TYPE,
  category: 'content-layout',
  name: 'Tab',
  description: 'A tab within a tabbed content block.',
  mdxComponent: {
    component: Tab,
    mode: 'block',
    allowedProps: ['label'],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: TabEditable,
      nodeOptions: {},
      mdxRule: tabMdxRule
      // No slashCommand — Tab is only ever created via Tabs' own add/insert logic,
      // not directly from the slash menu (mirrors Column's own registration).
    }
  }
});
