import type React from 'react';
import { defineMdxComponent } from '../../defineMdxComponent';
import { Tab } from './Tab';
import { TabEditable, tabMdxRule } from './TabEditable';
import type { TabSlateElement } from './types';

export const tabSpec = defineMdxComponent<
  TabSlateElement,
  { label?: string; children?: React.ReactNode },
  'block'
>({
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
});
