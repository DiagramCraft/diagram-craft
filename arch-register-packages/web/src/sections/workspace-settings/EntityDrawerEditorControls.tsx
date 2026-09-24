import { useEffect, useRef, useState } from 'react';
import {
  TbChartBar,
  TbDots,
  TbLink,
  TbMessage,
  TbPlus,
  TbPuzzle,
  TbSearch,
  TbSquare,
  TbTag
} from 'react-icons/tb';
import { Menu } from '@diagram-craft/app-components/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import type {
  EntityDrawerCatalog,
  EntityDrawerItem,
  EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  getMetricPathOptions,
  type MetricPathOption
} from '../entities/components/mapMetricConfig';
import layoutStyles from './SchemaLayoutEditor.module.css';

const useCloseOnOutsideClick = (open: boolean, onClose: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, open]);
  return ref;
};

type PickerOption = { value: string; label: string; pick: () => void };
export type PickerGroup = { label: string; options: PickerOption[] };

export type MetadataSlotId = Extract<EntityDrawerItem, { kind: 'metadata' }>['slot'];

type RelationRollupOption = {
  path: MetricPathOption;
  sourceSchema: EntitySchema;
  field: EntitySchema['fields'][number];
};

export type RollupSourceOption = {
  key: string;
  label: string;
  sourceSchemaId?: string;
  fieldId: string;
  fieldType: string;
  traversal?: RelationRollupOption['path']['step'];
};

export type AvailableChild = {
  childSchema: EntityDrawerCatalog['schemas'][number];
  field: EntityDrawerCatalog['schemas'][number]['fields'][number];
};

export const fieldItemKind = (type: string): 'field' | 'relation' =>
  type === 'reference' || type === 'containment' || type === 'typedRelation' ? 'relation' : 'field';

export const rollupSourceKey = (
  fieldId: string,
  sourceSchemaId?: string,
  traversal?: RelationRollupOption['path']['step']
): string => `${sourceSchemaId ?? 'self'}:${fieldId}:${JSON.stringify(traversal ?? null)}`;

export const getRelationRollupOptions = (
  schema: EntitySchema,
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): RelationRollupOption[] =>
  getMetricPathOptions(schema, relationSchemas, () => 'edit', schemas).flatMap(path =>
    path.targetSchemaIds.flatMap(targetSchemaId => {
      const sourceSchema = schemas.find(candidate => candidate.id === targetSchemaId);
      if (!sourceSchema) return [];
      return sourceSchema.fields
        .filter(
          field => field.archived !== true && (field.type === 'number' || field.type === 'currency')
        )
        .map(field => ({ path, sourceSchema, field }));
    })
  );

export const AddMenu = ({ label, groups }: { label: string; groups: PickerGroup[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useCloseOnOutsideClick(open, () => setOpen(false));
  const availableGroups = groups.filter(group => group.options.length > 0);

  return (
    <div className={layoutStyles.addMenuWrap} ref={ref}>
      <button
        type="button"
        className={layoutStyles.addBlockBtn}
        onClick={() => setOpen(current => !current)}
      >
        <TbPlus size={10} /> {label}
      </button>
      {open && (
        <div className={layoutStyles.menu}>
          {availableGroups.length === 0 && (
            <div className={layoutStyles.menuEmpty}>Everything available is already placed</div>
          )}
          {availableGroups.map((group, groupIndex) => (
            <div key={group.label || groupIndex} className={layoutStyles.menuGroup}>
              {group.label && <div className={layoutStyles.menuLabel}>{group.label}</div>}
              {group.options.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={layoutStyles.menuItem}
                  onClick={() => {
                    option.pick();
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SectionMenu = ({
  showTitle,
  layout,
  collapsible,
  onToggleShowTitle,
  onSetLayout,
  onToggleCollapsible,
  onRemove
}: {
  showTitle: boolean;
  layout: 'rows' | 'stat-grid';
  collapsible: boolean;
  onToggleShowTitle: (value: boolean) => void;
  onSetLayout: (value: 'rows' | 'stat-grid') => void;
  onToggleCollapsible: (value: boolean) => void;
  onRemove: () => void;
}) => (
  <MenuButton.Root>
    <MenuButton.Trigger variant="icon-only" size="xs" aria-label="Section options">
      <TbDots size={12} />
    </MenuButton.Trigger>
    <MenuButton.Menu align="end">
      <Menu.CheckboxItem checked={showTitle} onCheckedChange={onToggleShowTitle}>
        Show title
      </Menu.CheckboxItem>
      <Menu.CheckboxItem
        checked={collapsible}
        disabled={!showTitle}
        onCheckedChange={onToggleCollapsible}
      >
        Collapsible
      </Menu.CheckboxItem>
      <Menu.SubMenu label="Layout">
        <Menu.RadioGroup value={layout}>
          <Menu.RadioItem value="rows" onClick={() => onSetLayout('rows')}>
            Rows
          </Menu.RadioItem>
          <Menu.RadioItem value="stat-grid" onClick={() => onSetLayout('stat-grid')}>
            2-column mini-panels
          </Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.SubMenu>
      <Menu.Separator />
      <Menu.Item type="danger" onClick={onRemove}>
        Remove section
      </Menu.Item>
    </MenuButton.Menu>
  </MenuButton.Root>
);

export const ItemMenu = ({
  sectionId,
  sections,
  presentation,
  onSetPresentation,
  showLabel,
  onToggleShowLabel,
  onMoveTo,
  onRemove
}: {
  sectionId: string;
  sections: EntityDrawerProfile['sections'];
  presentation?: 'row' | 'mini-panel';
  onSetPresentation?: (value: 'row' | 'mini-panel') => void;
  showLabel?: boolean;
  onToggleShowLabel?: (value: boolean) => void;
  onMoveTo: (sectionId: string) => void;
  onRemove: () => void;
}) => (
  <MenuButton.Root>
    <MenuButton.Trigger variant="icon-only" size="xs" aria-label="Content options">
      <TbDots size={10} />
    </MenuButton.Trigger>
    <MenuButton.Menu align="end">
      {presentation !== undefined && onSetPresentation && (
        <Menu.SubMenu label="Presentation">
          <Menu.RadioGroup value={presentation}>
            <Menu.RadioItem value="row" onClick={() => onSetPresentation('row')}>
              Row
            </Menu.RadioItem>
            <Menu.RadioItem value="mini-panel" onClick={() => onSetPresentation('mini-panel')}>
              Mini-panel
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.SubMenu>
      )}
      {presentation !== undefined && showLabel !== undefined && <Menu.Separator />}
      {showLabel !== undefined && onToggleShowLabel && (
        <Menu.CheckboxItem checked={showLabel} onCheckedChange={onToggleShowLabel}>
          Show label
        </Menu.CheckboxItem>
      )}
      {showLabel !== undefined && <Menu.Separator />}
      {sections.length > 1 && (
        <Menu.SubMenu label="Move to section">
          {sections
            .filter(section => section.id !== sectionId)
            .map(section => (
              <Menu.Item key={section.id} onClick={() => onMoveTo(section.id)}>
                {section.title}
              </Menu.Item>
            ))}
        </Menu.SubMenu>
      )}
      {sections.length > 1 && <Menu.Separator />}
      <Menu.Item type="danger" onClick={onRemove}>
        Remove content
      </Menu.Item>
    </MenuButton.Menu>
  </MenuButton.Root>
);

export const itemReference = (item: EntityDrawerItem): string => {
  if (item.kind === 'metadata') return item.slot;
  if (item.kind === 'slot') return item.slotId;
  if (item.kind === 'children') return `${item.childSchemaId}:${item.fieldId}`;
  if (item.kind === 'rollup-leaf-count') return item.kind;
  if (item.kind === 'placeholder') return item.message;
  if (item.kind === 'query') return item.queryText;
  return item.fieldId;
};

export const itemPresentation = (
  item: EntityDrawerItem,
  catalog: EntityDrawerCatalog
): 'row' | 'mini-panel' | undefined => {
  if (item.kind !== 'field' && item.kind !== 'slot') return undefined;
  if (
    item.kind === 'slot' &&
    catalog.slots.find(slot => slot.id === item.slotId)?.fixedPresentation !== undefined
  ) {
    return undefined;
  }
  return item.presentation ?? 'row';
};

export const itemLabel = (
  item: EntityDrawerItem,
  catalog: EntityDrawerCatalog,
  schemaId: string
): string => {
  if (item.kind === 'placeholder') return item.message;
  if (item.label) return item.label;
  if (item.kind === 'metadata')
    return catalog.metadataSlots.find(slot => slot.id === item.slot)?.label ?? item.slot;
  if (item.kind === 'slot')
    return catalog.slots.find(slot => slot.id === item.slotId)?.label ?? item.slotId;
  if (item.kind === 'children') {
    const childSchema = catalog.schemas.find(schema => schema.id === item.childSchemaId);
    const field = childSchema?.fields.find(candidate => candidate.id === item.fieldId);
    return `${childSchema?.name ?? item.childSchemaId} · ${field?.name ?? item.fieldId}`;
  }
  if (item.kind === 'rollup-leaf-count') return 'Leaf count';
  if (item.kind === 'rollup') {
    const field = catalog.schemas
      .find(schema => schema.id === (item.sourceSchemaId ?? schemaId))
      ?.fields.find(candidate => candidate.id === item.fieldId);
    const source = item.sourceSchemaId ? ` · ${item.sourceSchemaId}` : '';
    return `Roll-up · ${field?.name ?? item.fieldId}${source}`;
  }
  if (item.kind === 'query') return item.queryText;
  return (
    catalog.schemas
      .find(schema => schema.id === schemaId)
      ?.fields.find(field => field.id === item.fieldId)?.name ?? item.fieldId
  );
};

export const ItemIcon = ({ kind }: { kind: EntityDrawerItem['kind'] }) => {
  if (kind === 'metadata') return <TbTag size={11} />;
  if (kind === 'relation' || kind === 'typed-relation-list') return <TbLink size={11} />;
  if (kind === 'children') return <TbLink size={11} />;
  if (kind === 'slot') return <TbPuzzle size={11} />;
  if (kind === 'rollup' || kind === 'rollup-leaf-count') return <TbChartBar size={11} />;
  if (kind === 'placeholder') return <TbMessage size={11} />;
  if (kind === 'query') return <TbSearch size={11} />;
  return <TbSquare size={11} />;
};

export type ProfileSection = EntityDrawerProfile['sections'][number];
export type ProfileSectionUpdater = (section: ProfileSection) => ProfileSection;
export type ProfileUpdater = (profile: EntityDrawerProfile) => void;
export type AvailableFields = EntityDrawerCatalog['schemas'][number]['fields'];
