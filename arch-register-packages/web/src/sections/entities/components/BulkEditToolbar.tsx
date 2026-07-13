import { useState } from 'react';
import { TbCheck, TbEraser, TbPlus, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Menu } from '@diagram-craft/app-components/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { BulkFieldInput } from './BulkFieldInput';
import { canClearBulkField, type BulkEditableField } from './bulkEditFields';
import type { BulkEditResult, BulkEditStep, BulkFieldRow } from './useEntityBrowserSelection';
import { entityName } from './entityBrowserViewShared';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import styles from './BulkEditToolbar.module.css';

export type BulkEditToolbarProps = {
  workspaceId: string;
  count: number;
  selectedEntities: EntityRecord[];
  fieldRows: BulkFieldRow[];
  availableFields: BulkEditableField[];
  step: BulkEditStep;
  result: BulkEditResult | null;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  addFieldRow: (fieldId: string) => void;
  updateFieldRow: (rowId: string, changes: Partial<BulkFieldRow>) => void;
  removeFieldRow: (rowId: string) => void;
  setStep: (step: BulkEditStep) => void;
  onClear: () => void;
  onConfirm: () => void;
};

export const BulkEditToolbar = ({
  workspaceId,
  count,
  selectedEntities,
  fieldRows,
  availableFields,
  step,
  result,
  lifecycleStates,
  teams,
  addFieldRow,
  updateFieldRow,
  removeFieldRow,
  setStep,
  onClear,
  onConfirm
}: BulkEditToolbarProps) => {
  const usedFieldIds = new Set(fieldRows.map(row => row.fieldId));
  const remainingFields = availableFields.filter(field => !usedFieldIds.has(field.id));
  const activeRows = fieldRows.filter(row => row.clearing || row.value !== '');
  const permSkipped = selectedEntities.filter(entity => entity.canEdit === false);
  const isConfirm = step === 'confirm';
  const isDone = step === 'done';
  const hasPartial = isDone && result != null && result.skipped.length > 0;

  return (
    <div className={styles.bulkBar + (isConfirm || hasPartial ? ` ${styles.bulkBarConfirm}` : '')}>
      <span className={styles.bulkCount}>
        <span className={styles.bulkCountPill}>
          <TbCheck size={9} />
          <span>{count}</span>
        </span>
        <span className={styles.bulkCountLabel}>
          {count === 1 ? 'entity' : 'entities'} selected
        </span>
      </span>

      {step === 'edit' && (
        <>
          <div className={styles.bulkSep} />

          <div className={styles.bulkFields}>
            {fieldRows.map(row => {
              const field = availableFields.find(f => f.id === row.fieldId);
              if (!field) return null;
              return (
                <span key={row.rowId} className={styles.bulkField}>
                  <span className={styles.bulkFieldLabel}>{field.label}</span>
                  <BulkFieldInput
                    workspaceId={workspaceId}
                    field={field}
                    value={row.value}
                    clearing={row.clearing}
                    teams={teams}
                    lifecycleStates={lifecycleStates}
                    onValue={value => updateFieldRow(row.rowId, { value, clearing: false })}
                    onClearing={clearing => updateFieldRow(row.rowId, { clearing, value: '' })}
                  />
                  <div style={{ display: 'flex' }}>
                    {canClearBulkField(field) && !row.clearing && (
                      <button
                        type="button"
                        className={styles.bulkRowClearBtn}
                        title={`Clear ${field.label} on selected entities`}
                        onClick={() => updateFieldRow(row.rowId, { clearing: true, value: '' })}
                      >
                        <TbEraser size={9} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.bulkRowRm}
                      title="Remove"
                      onClick={() => removeFieldRow(row.rowId)}
                    >
                      <TbX size={9} />
                    </button>
                  </div>
                </span>
              );
            })}

            {remainingFields.length > 0 && (
              <BulkAddFieldMenu
                count={count}
                label={fieldRows.length === 0 ? 'Set a field' : 'Add field'}
                fields={remainingFields}
                onSelect={addFieldRow}
              />
            )}
          </div>

          <div style={{ flex: 1 }} />

          {activeRows.length > 0 && (
            <Button size="xs" variant="primary" onClick={() => setStep('confirm')}>
              Review changes
            </Button>
          )}
          <Button size="xs" onClick={onClear}>
            <TbX size={11} />
            <span>Clear</span>
          </Button>
        </>
      )}

      {isConfirm && (
        <>
          <div className={styles.bulkSep} />
          <div className={styles.bulkConfirmMsg}>
            <span className={styles.bulkWarnIcon}>!</span>
            <span>
              {activeRows.map((row, i) => {
                const field = availableFields.find(f => f.id === row.fieldId);
                return (
                  <span key={row.rowId}>
                    {i > 0 && <span className={styles.bulkDim}> · </span>}
                    <span className={styles.bulkDim}>
                      {field ? field.label : row.fieldId} →
                    </span>{' '}
                    {row.clearing ? <em>cleared</em> : <b>{row.value}</b>}
                  </span>
                );
              })}
              <span className={styles.bulkDim}> for </span>
              <b>{count - permSkipped.length}</b>
              <span className={styles.bulkDim}>
                {' '}
                of {count} {count === 1 ? 'entity' : 'entities'}
              </span>
              {permSkipped.length > 0 && (
                <span className={styles.bulkPermWarn}>
                  {' · '}
                  {permSkipped.length} skipped — no edit permission
                </span>
              )}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <Button size="sm" variant="secondary" onClick={() => setStep('edit')}>
            Back
          </Button>
          <Button size="sm" variant="primary" onClick={onConfirm}>
            Confirm
          </Button>
        </>
      )}

      {isDone && result && (
        <>
          <div className={styles.bulkSep} />
          <div className={styles.bulkConfirmMsg}>
            {result.skipped.length === 0 ? (
              <>
                <span className={styles.bulkDoneIcon}>
                  <TbCheck size={11} />
                </span>{' '}
                Applied to <b>{result.applied.length}</b>{' '}
                {result.applied.length === 1 ? 'entity' : 'entities'}
              </>
            ) : (
              <>
                <span className={styles.bulkDoneIcon}>
                  <TbCheck size={11} />
                </span>{' '}
                Applied to <b>{result.applied.length}</b> of <b>{count}</b>{' '}
                {count === 1 ? 'entity' : 'entities'}
                <span className={styles.bulkSkipInfo}>
                  <span className={styles.bulkDim}>Skipped:</span>
                  {result.skipped.map(s => (
                    <span key={s.entity._uid} className={styles.bulkSkipItem} title={s.reason}>
                      {entityName(s.entity)}
                    </span>
                  ))}
                  <span className={styles.bulkDim}>— {result.skipped[0]!.reason}</span>
                </span>
              </>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <Button size="sm" variant="secondary" onClick={onClear}>
            <TbX size={11} />
            <span>Dismiss</span>
          </Button>
        </>
      )}
    </div>
  );
};

type BulkAddFieldMenuProps = {
  count: number;
  label: string;
  fields: BulkEditableField[];
  onSelect: (fieldId: string) => void;
};

// Custom menu (rather than the shared DropdownMenu) so the header and item padding can be sized
// for a compact inline picker instead of the app's default icon-led menu style.
const BulkAddFieldMenu = ({ count, label, fields, onSelect }: BulkAddFieldMenuProps) => {
  const [open, setOpen] = useState(false);

  return (
    <MenuButton.Root open={open} onOpenChange={setOpen}>
      <MenuButton.Trigger
        element={
          <button type="button" className={styles.bulkAddField}>
            <TbPlus size={10} />
            <span>{label}</span>
          </button>
        }
      />
      <MenuButton.Menu>
        <div className={styles.bulkFieldPickerHeader}>
          Set field on {count} {count === 1 ? 'entity' : 'entities'}
        </div>
        <Menu.Separator />
        {fields.map(field => (
          <Menu.Item
            key={field.id}
            className={styles.bulkFieldPickerItem}
            onClick={() => {
              onSelect(field.id);
              setOpen(false);
            }}
          >
            {field.label}
          </Menu.Item>
        ))}
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};
