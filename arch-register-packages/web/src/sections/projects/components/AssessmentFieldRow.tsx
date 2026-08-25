import { useState, type RefCallback } from 'react';
import { TbAlignLeft, TbDatabase, TbDots, TbEdit, TbStar } from 'react-icons/tb';
import type { AssessmentField, AssessmentGroup } from '@arch-register/api-types/assessmentContract';
import { Button } from '@diagram-craft/app-components/Button';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { usePortal } from '@diagram-craft/app-components/PortalContext';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FieldConfig } from '../../../components/FieldConfig';
import {
  AssessmentDerivedExpressionDialog,
  AssessmentInlineEnumDialog
} from './AssessmentFieldDialogs';
import styles from '../ProjectAssessments.module.css';

export const FIELD_TYPE_OPTIONS: [AssessmentField['type'], string][] = [
  ['rating', 'Rating'],
  ['enum', 'Select'],
  ['text', 'Notes'],
  ['derived', 'Derived']
];

export const FIELD_TYPE_META: Record<
  AssessmentField['type'],
  { icon: typeof TbStar; hint: string | null }
> = {
  rating: { icon: TbStar, hint: '1 – 5' },
  enum: { icon: TbDatabase, hint: null },
  text: { icon: TbAlignLeft, hint: 'free text' },
  derived: { icon: TbDatabase, hint: null }
};

export const NO_GROUP = '__no_group__';

export type AssessmentFieldRowProps = {
  field: AssessmentField;
  groups: AssessmentGroup[];
  onUpdate: (changes: Partial<AssessmentField>) => void;
  onRemove: () => void;
  dragHandleRef: RefCallback<HTMLElement>;
};

export const AssessmentFieldRow = ({
  field,
  groups,
  onUpdate,
  onRemove,
  dragHandleRef
}: AssessmentFieldRowProps) => {
  const { enums } = useWorkspaceContext();
  const portal = usePortal();
  const [inlineOptionsOpen, setInlineOptionsOpen] = useState(false);
  const [expressionTestOpen, setExpressionTestOpen] = useState(false);
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta.icon;
  const placeholders: Record<AssessmentField['type'], string> = {
    rating: 'Rating label…',
    enum: 'Select label…',
    text: 'Notes label…',
    derived: 'Derived label…'
  };

  const options = (() => {
    if (field.type === 'enum') {
      return (
        <>
          <FormElement label="Source">
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Select.Root
                value={'options' in field ? 'inline' : 'workspace'}
                onChange={value => {
                  if (value === 'inline') {
                    onUpdate({
                      options:
                        'options' in field && field.options.length > 0
                          ? field.options
                          : [{ value: 'option_1', label: '' }],
                      enumId: undefined
                    } as Partial<AssessmentField>);
                  } else {
                    onUpdate({
                      enumId: ('enumId' in field ? field.enumId : undefined) ?? enums[0]?.id ?? '',
                      options: undefined
                    } as Partial<AssessmentField>);
                  }
                }}
              >
                <Select.Item value="workspace">Existing enum</Select.Item>
                <Select.Item value="inline">Inline values</Select.Item>
              </Select.Root>
              {'options' in field && (
                <Button
                  variant="ghost"
                  icon={<TbEdit size={13} />}
                  onClick={() => {
                    setInlineOptionsOpen(true);
                  }}
                  title="Edit inline values"
                />
              )}
            </span>
          </FormElement>
          {!('options' in field) && (
            <FormElement label="Enum">
              <Select.Root
                value={field.enumId}
                placeholder="Choose enum…"
                onChange={value => onUpdate({ enumId: value ?? '' } as Partial<AssessmentField>)}
              >
                {enums.map(en => (
                  <Select.Item key={en.id} value={en.id}>
                    {en.name}
                  </Select.Item>
                ))}
              </Select.Root>
            </FormElement>
          )}
        </>
      );
    }
    if (field.type === 'derived') {
      return (
        <>
          <FormElement label="Result type">
            <Select.Root
              value={field.resultType}
              onChange={value =>
                onUpdate({
                  resultType: (value ?? 'text') as Extract<
                    AssessmentField,
                    { type: 'derived' }
                  >['resultType'],
                  enumId: undefined,
                  options: undefined
                } as Partial<AssessmentField>)
              }
            >
              <Select.Item value="text">Text</Select.Item>
              <Select.Item value="number">Number</Select.Item>
              <Select.Item value="select">Select</Select.Item>
              <Select.Item value="boolean">Boolean</Select.Item>
              <Select.Item value="rating">Rating</Select.Item>
            </Select.Root>
          </FormElement>
          {field.resultType === 'select' && (
            <FormElement label="Source">
              <Select.Root
                value={'options' in field ? 'inline' : 'workspace'}
                onChange={value =>
                  onUpdate(
                    value === 'inline'
                      ? { options: [{ value: 'option_1', label: '' }], enumId: undefined }
                      : { enumId: enums[0]?.id ?? '', options: undefined }
                  )
                }
              >
                <Select.Item value="workspace">Existing enum</Select.Item>
                <Select.Item value="inline">Inline values</Select.Item>
              </Select.Root>
            </FormElement>
          )}
          <FormElement
            label="Expression"
            hint="Reference response fields through assessment.field or assessment['field-id']"
          >
            <TextInput
              value={field.expression}
              onChange={value => onUpdate({ expression: value ?? '' })}
              placeholder="assessment.input_field"
            />
          </FormElement>
        </>
      );
    }
    return undefined;
  })();

  const menu = (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={<Button variant="ghost" icon={<TbDots size={13} />} title="More field actions" />}
      />
      <MenuButton.Menu container={portal}>
        <Menu.SubMenu label="Move to group" container={portal}>
          <Menu.RadioGroup value={field.groupId ?? NO_GROUP}>
            <Menu.RadioItem value={NO_GROUP} onClick={() => onUpdate({ groupId: undefined })}>
              No group
            </Menu.RadioItem>
            {groups.map(group => (
              <Menu.RadioItem
                key={group.id}
                value={group.id}
                onClick={() => onUpdate({ groupId: group.id })}
              >
                {group.name}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.SubMenu>
        <Menu.Separator />
        {field.type === 'derived' && (
          <Menu.Item onClick={() => setExpressionTestOpen(true)}>Test expression</Menu.Item>
        )}
        {field.type === 'derived' && <Menu.Separator />}
        <Menu.Item type="danger" onClick={onRemove}>
          Delete field
        </Menu.Item>
      </MenuButton.Menu>
    </MenuButton.Root>
  );

  return (
    <>
      <FieldConfig dragHandleRef={dragHandleRef} options={options} menu={menu}>
        <FieldConfig.Cell label="Id" mono flexBasis={140}>
          <TextInput
            value={field.id}
            onChange={value => onUpdate({ id: value ?? field.id })}
            style={{ width: '100%' }}
          />
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Label" flexBasis={200}>
          <TextInput
            value={field.label}
            onChange={value => onUpdate({ label: value ?? '' })}
            placeholder={placeholders[field.type]}
            style={{ width: '100%' }}
          />
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Type" flexBasis={130}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon size={13} />
            {FIELD_TYPE_OPTIONS.find(([type]) => type === field.type)?.[1]}
            {meta.hint && <span className={styles.fieldHint}>{meta.hint}</span>}
          </span>
        </FieldConfig.Cell>
        <FieldConfig.Cell label="Completeness" flexBasis={120}>
          <Select.Root
            value={field.requirementLevel}
            disabled={field.type === 'derived'}
            onChange={value =>
              onUpdate({ requirementLevel: (value ?? 'required') as 'required' | 'optional' })
            }
            style={{ width: '100%' }}
          >
            <Select.Item value="required">Required</Select.Item>
            <Select.Item value="optional">Optional</Select.Item>
          </Select.Root>
        </FieldConfig.Cell>
      </FieldConfig>
      {field.type === 'derived' && (
        <AssessmentDerivedExpressionDialog
          open={expressionTestOpen}
          field={field}
          onClose={() => setExpressionTestOpen(false)}
          onSave={expression => {
            onUpdate({ expression });
            setExpressionTestOpen(false);
          }}
        />
      )}
      {field.type === 'enum' && 'options' in field && (
        <AssessmentInlineEnumDialog
          open={inlineOptionsOpen}
          field={field}
          onClose={() => setInlineOptionsOpen(false)}
          onSave={options => onUpdate({ options } as Partial<AssessmentField>)}
        />
      )}
    </>
  );
};
