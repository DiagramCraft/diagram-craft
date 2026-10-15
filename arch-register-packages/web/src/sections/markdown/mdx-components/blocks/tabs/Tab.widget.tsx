import { defineWidget } from '../../defineWidget';
import { Tab } from './Tab';
import { TAB_TYPE } from './TabEditable';
import { TabEditable, tabMdxRule } from './TabEditable';
export default defineWidget({
  type: TAB_TYPE,
  category: 'content-layout',
  name: 'Tab',
  description: 'A tab within a tabbed content block.',
  component: Tab,
  mdx: {
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
