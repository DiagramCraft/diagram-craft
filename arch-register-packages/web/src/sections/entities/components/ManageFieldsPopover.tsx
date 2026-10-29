import { useRef, useState } from 'react';
import { TbChevronDown, TbChevronRight, TbColumns3, TbSettings } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { ToolbarButton } from '../../../components/ToolbarButton';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { ColumnRenderConfig } from '@arch-register/api-types/viewContract';
import { ColumnRendererEditor } from './ColumnRendererEditor';
import { hasColumnRendererChoice } from './columnRenderers';
import type { EntityDisplayField } from './entityDisplayFields';
import styles from './EntityBrowser.module.css';

export const ManageFieldsPopover = ({
  fields,
  selectedIds,
  onChange,
  onReset,
  columnRenderers,
  onColumnRenderersChange,
  disabled = false
}: {
  fields: EntityDisplayField[];
  selectedIds: string[];
  onChange: (fieldIds: string[]) => void;
  onReset?: () => void;
  /** Table view only: per-column renderers keyed by field id, and their setter. */
  columnRenderers?: Record<string, ColumnRenderConfig>;
  onColumnRenderersChange?: (columnRenderers: Record<string, ColumnRenderConfig>) => void;
  disabled?: boolean;
}) => {
  const actionsRef = useRef<PopoverActions | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const groups = new Map<string, EntityDisplayField[]>();
  for (const field of fields) groups.set(field.group, [...(groups.get(field.group) ?? []), field]);

  // Sections start open when they're the General section or contain a checked field. Computed when
  // the popover opens (not live), so unchecking the last field doesn't collapse the section under
  // the cursor.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const initialOpenGroups = () =>
    new Set(
      [...groups]
        .filter(
          ([group, options]) =>
            group === 'General' || options.some(field => selectedIds.includes(field.id))
        )
        .map(([group]) => group)
    );
  const toggleGroup = (group: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (!next.delete(group)) next.add(group);
      return next;
    });
  return (
    <Popover.Root
      actionsRef={actionsRef}
      onOpenChange={open => {
        if (open) setOpenGroups(initialOpenGroups());
      }}
    >
      <Popover.Trigger
        element={
          <ToolbarButton
            variant="secondary"
            icon={<TbColumns3 size={12} />}
            aria-label="Manage fields"
            title="Manage fields"
            disabled={disabled}
          />
        }
      />
      <Popover.Content
        sideOffset={4}
        align="end"
        arrow={false}
        closeButton={false}
        className={styles.fieldsPopover}
      >
        {[...groups].map(([group, options]) => (
          <div key={group} className={styles.fieldsGroup}>
            <button
              type="button"
              className={styles.fieldsGroupToggle}
              aria-expanded={openGroups.has(group)}
              onClick={() => toggleGroup(group)}
            >
              {openGroups.has(group) ? <TbChevronDown size={11} /> : <TbChevronRight size={11} />}
              {group}
            </button>
            {openGroups.has(group) &&
              options.map(field => (
                <div key={field.id}>
                  <div className={styles.fieldsRow}>
                    <label className={styles.fieldsOption}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(field.id)}
                        onChange={() =>
                          onChange(
                            selectedIds.includes(field.id)
                              ? selectedIds.filter(id => id !== field.id)
                              : [...selectedIds, field.id]
                          )
                        }
                      />
                      {field.label}
                    </label>
                    {onColumnRenderersChange &&
                      selectedIds.includes(field.id) &&
                      hasColumnRendererChoice(field) && (
                        <button
                          type="button"
                          className={styles.fieldsConfigure}
                          data-active={(columnRenderers?.[field.id]?.type ?? 'plain') !== 'plain'}
                          aria-label={`Configure ${field.label} rendering`}
                          aria-expanded={expandedIds.has(field.id)}
                          title="Configure rendering"
                          onClick={() => toggleExpanded(field.id)}
                        >
                          <TbSettings size={13} />
                        </button>
                      )}
                  </div>
                  {onColumnRenderersChange &&
                    selectedIds.includes(field.id) &&
                    hasColumnRendererChoice(field) &&
                    expandedIds.has(field.id) && (
                      <ColumnRendererEditor
                        field={field}
                        config={columnRenderers?.[field.id] ?? { type: 'plain' }}
                        onChange={next => {
                          const { [field.id]: _removed, ...others } = columnRenderers ?? {};
                          onColumnRenderersChange(
                            next.type === 'plain' ? others : { ...others, [field.id]: next }
                          );
                        }}
                      />
                    )}
                </div>
              ))}
          </div>
        ))}
        {onReset && (
          <div className={styles.fieldsFooter}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onReset();
                actionsRef.current?.close();
              }}
            >
              Reset to defaults
            </Button>
          </div>
        )}
      </Popover.Content>
    </Popover.Root>
  );
};
