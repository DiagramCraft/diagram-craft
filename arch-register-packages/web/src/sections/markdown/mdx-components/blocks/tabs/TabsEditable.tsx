import { useLayoutEffect, useRef, useState, Children } from 'react';
import { createPlatePlugin, useEditorRef, type PlateElementProps } from 'platejs/react';
import { ElementApi, getPluginType, type TElement } from 'platejs';
import {
  convertChildrenDeserialize,
  convertNodesSerialize,
  type MdMdxJsxFlowElement
} from '@platejs/markdown';
import { TbChevronLeft, TbChevronRight, TbPlus, TbX } from 'react-icons/tb';
import type { MdxRuleDef } from '../../defineMdxComponent';
import { EditorBlock } from '../../../editor/EditorBlock';
import { TAB_TYPE } from './TabEditable';
import type { TabSlateElement, TabsSlateElement } from './types';
import styles from './Tabs.module.css';

export const TABS_TYPE = 'Tabs' as const;

const emptyTab = (): TElement => ({
  type: TAB_TYPE,
  label: '',
  children: [{ type: 'p', children: [{ text: '' }] }]
});

export const tabsMdxRule: MdxRuleDef<TabsSlateElement, 'block'> = {
  deserialize: (mdastNode, deco, options) => {
    const deserializedChildren = convertChildrenDeserialize(
      mdastNode.children ?? [],
      deco,
      options
    ) as TElement[];
    const tabChildren = deserializedChildren.filter(
      child => typeof child === 'object' && child !== null && child.type === TAB_TYPE
    );

    return {
      children: tabChildren.length > 0 ? tabChildren : [emptyTab()],
      type: getPluginType(options.editor!, TABS_TYPE)
    };
  },
  serialize: (slateNode, options) => ({
    attributes: [],
    // convertNodesSerialize returns generic unist nodes; the mdast-mdx typings
    // don't narrow that to MdxJsxFlowElement's own child union, so this cast
    // is the one framework-seam assertion this rule needs (see AllowedPropKey
    // design notes in defineMdxComponent.ts).
    children: convertNodesSerialize(
      slateNode.children ?? [],
      options
    ) as MdMdxJsxFlowElement['children'],
    name: TABS_TYPE,
    type: 'mdxJsxFlowElement'
  })
};

const TabHeaderLabelInput = ({
  tab,
  onSelect,
  onCommit
}: {
  tab: TabSlateElement;
  onSelect: () => void;
  onCommit: (value: string) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);

  // Uncontrolled, mirroring FoldableSectionEditable's label input: only resync
  // the DOM when the label changed externally (initial mount, undo/redo, a
  // move/remove re-keying this input elsewhere), never mid-keystroke.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const label = tab.label ?? '';
    if (node.value !== label) {
      node.value = label;
    }
  }, [tab.label]);

  return (
    <input
      ref={ref}
      type="text"
      className={styles.tabLabelInput}
      placeholder="Tab label…"
      defaultValue={tab.label ?? ''}
      onMouseDown={event => {
        event.stopPropagation();
        onSelect();
      }}
      onBlur={event => onCommit(event.currentTarget.value)}
    />
  );
};

export const TabsEditable = ({
  element,
  children,
  ...props
}: PlateElementProps<TabsSlateElement>) => {
  const editor = useEditorRef();
  const [activeIndex, setActiveIndex] = useState(0);

  const tabs = (element.children ?? []) as TabSlateElement[];
  const clampedActive = tabs.length === 0 ? 0 : Math.min(activeIndex, tabs.length - 1);
  const panels = Children.toArray(children);

  const tabsPath = () => editor.api.findPath(element);

  const commitLabel = (idx: number, value: string) => {
    const path = tabsPath();
    if (!path) return;
    editor.tf.setNodes({ label: value }, { at: [...path, idx] });
  };

  const addTab = () => {
    const path = tabsPath();
    if (!path) return;
    const insertAt = tabs.length;
    editor.tf.insertNodes(emptyTab(), { at: [...path, insertAt] });
    setActiveIndex(insertAt);
  };

  const removeTab = (idx: number) => {
    const path = tabsPath();
    if (!path || tabs.length <= 1) return;
    editor.tf.removeNodes({ at: [...path, idx] });
    setActiveIndex(prev => (prev >= idx && prev > 0 ? prev - 1 : prev));
  };

  const moveTab = (idx: number, direction: -1 | 1) => {
    const path = tabsPath();
    const targetIdx = idx + direction;
    if (!path || targetIdx < 0 || targetIdx >= tabs.length) return;
    const node = tabs[idx];
    if (!node) return;
    editor.tf.removeNodes({ at: [...path, idx] });
    editor.tf.insertNodes(node, { at: [...path, targetIdx] });
    setActiveIndex(targetIdx);
  };

  return (
    <EditorBlock element={element} {...props}>
      <div className={styles.editorContainer}>
        <div contentEditable={false} className={styles.toolbar}>
          {tabs.map((tab, idx) => (
            <div
              key={tab.id as string}
              className={`${styles.tabHeader} ${idx === clampedActive ? styles.tabHeaderActive : ''}`}
              onMouseDown={event => {
                // Clicking the header row's own padding (outside the label
                // input/buttons, which each handle selection themselves)
                // switches which panel is visible for editing.
                if (event.target === event.currentTarget) setActiveIndex(idx);
              }}
            >
              <TabHeaderLabelInput
                tab={tab}
                onSelect={() => setActiveIndex(idx)}
                onCommit={value => commitLabel(idx, value)}
              />
              <button
                type="button"
                className={styles.tabHeaderBtn}
                title="Move left"
                disabled={idx === 0}
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  moveTab(idx, -1);
                }}
              >
                <TbChevronLeft size={11} />
              </button>
              <button
                type="button"
                className={styles.tabHeaderBtn}
                title="Move right"
                disabled={idx === tabs.length - 1}
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  moveTab(idx, 1);
                }}
              >
                <TbChevronRight size={11} />
              </button>
              <button
                type="button"
                className={styles.tabHeaderBtn}
                title="Remove tab"
                disabled={tabs.length <= 1}
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeTab(idx);
                }}
              >
                <TbX size={11} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.addTabBtn}
            onMouseDown={event => {
              event.preventDefault();
              event.stopPropagation();
              addTab();
            }}
          >
            <TbPlus size={11} style={{ verticalAlign: '-1px', marginRight: 2 }} />
            Add tab
          </button>
        </div>
        <div className={styles.editorPanels}>
          {panels.map((panel, idx) => (
            <div key={idx} className={idx === clampedActive ? undefined : styles.hiddenPanel}>
              {panel}
            </div>
          ))}
        </div>
      </div>
    </EditorBlock>
  );
};

/**
 * Enforces that a Tabs element's direct children are only Tab elements, and
 * that at least one is always present. Add/remove/reorder is handled
 * explicitly by TabsEditable above, not here, so this never fights those
 * transforms — it only guards structural validity (e.g. after a paste).
 */
export const TabsNormalizePlugin = createPlatePlugin({
  key: 'tabs-normalize',
  extendEditor({ editor }) {
    // biome-ignore lint/suspicious/noExplicitAny: Plate editor API requires flexible typing
    const normalizeNode = editor.normalizeNode as (entry: any) => void;
    // biome-ignore lint/suspicious/noExplicitAny: Plate editor API requires flexible typing
    editor.normalizeNode = (entry: any) => {
      const [node, path] = entry;
      if (ElementApi.isElement(node) && node.type === TABS_TYPE) {
        const kids = (node.children ?? []) as TElement[];
        const badIndex = kids.findIndex(kid => kid.type !== TAB_TYPE);
        if (badIndex !== -1) {
          editor.tf.removeNodes({ at: [...path, badIndex] });
          return;
        }
        if (kids.length < 1) {
          editor.tf.insertNodes(emptyTab(), { at: [...path, kids.length] });
          return;
        }
      }
      normalizeNode(entry);
    };
    return editor;
  }
});
