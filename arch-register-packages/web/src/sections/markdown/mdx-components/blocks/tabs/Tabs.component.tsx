import { TbLayoutNavbar } from 'react-icons/tb';
import { defineComponent } from '../../defineComponent';
import { Tabs } from './Tabs';
import { TAB_TYPE } from './TabEditable';
import { TABS_TYPE, TabsEditable, tabsMdxRule } from './TabsEditable';
export default defineComponent({
  type: TABS_TYPE,
  category: 'content-layout',
  name: 'Tabs',
  description: 'Present alternative content under selectable tabs',
  keywords: ['tabs', 'tab', 'switch', 'toggle'],
  component: Tabs,
  icon: TbLayoutNavbar,
  mdx: {
    mode: 'block',
    allowedProps: [],
    acceptsRichContent: true,
    editorSpec: {
      editableComponent: TabsEditable,
      nodeOptions: {},
      mdxRule: tabsMdxRule,
      slashCommand: {
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
  }
});
