import { useState } from 'react';
import { type PlateElementProps } from 'platejs/react';
import { getPluginType } from 'platejs';
import { parseAttributes, propsToAttributes } from '@platejs/markdown';
import { TbId } from 'react-icons/tb';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { Draggable } from '../../Draggable';
import { EntityCardBlock } from './EntityCardBlock';
import { EntityCardDialog } from './EntityCardDialog';
import type { EntityCardSlateElement } from './types';
import styles from './EntityCardEditor.module.css';

// ── MDX serialization rule (consumed by PlateMarkdownEditor) ─────────────────

// biome-ignore lint/suspicious/noExplicitAny: ok
export const entityCardMdxRule: Record<string, any> = {
  // biome-ignore lint/suspicious/noExplicitAny: ok
  deserialize: (mdastNode: any, _deco: unknown, options: any) => {
    const attrs = parseAttributes(mdastNode.attributes ?? []) as Record<string, unknown>;
    return {
      children: [{ text: '' }],
      type: getPluginType(options.editor, 'EntityCard'),
      entityId: attrs['id'] ?? '',
      fields: attrs['fields'] ?? ''
    };
  },
  // biome-ignore lint/suspicious/noExplicitAny: ok
  serialize: (slateNode: any) => ({
    attributes: propsToAttributes({
      id: slateNode.entityId ?? '',
      ...(slateNode.fields ? { fields: slateNode.fields } : {})
    }),
    children: [],
    name: 'EntityCard',
    type: 'mdxJsxFlowElement'
  })
};

// ── Plate element ─────────────────────────────────────────────────────────────

export const EntityCardPlateElement = ({ element, children, ...props }: PlateElementProps) => {
  const entityId = (element as EntityCardSlateElement).entityId ?? '';
  const fields = (element as EntityCardSlateElement).fields ?? '';
  const [pickerOpen, setPickerOpen] = useState(() => !entityId);
  const isNew = !entityId;

  const openPicker = () => setPickerOpen(true);

  return (
    <Draggable
      element={element}
      extraContextMenuItems={onClose => (
        <Menu.Item
          onClick={() => {
            openPicker();
            onClose();
          }}
        >
          Edit card
        </Menu.Item>
      )}
      {...props}
    >
      <div contentEditable={false}>
        {entityId ? (
          <EntityCardBlock id={entityId} fields={fields} onEdit={openPicker} />
        ) : (
          <div className={styles.entityCardPlaceholder} onClick={openPicker}>
            <TbId size={16} />
            <span>Choose entity…</span>
          </div>
        )}
      </div>
      {children}
      {pickerOpen && (
        <EntityCardDialog
          element={element}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          isNew={isNew}
        />
      )}
    </Draggable>
  );
};
