import { useQuery } from '@tanstack/react-query';
import { TbArrowsRightLeft, TbDatabase, TbFileText, TbFolders, TbSitemap } from 'react-icons/tb';
import { glossaryUsageQuery } from '../glossaryQueries';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderLabelProps,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import styles from './GlossaryEntityDrawerProvider.module.css';

const USAGE_KIND_LABEL = {
  entity: 'Referencing entities',
  relation: 'Typed relations',
  document: 'Linked documents',
  project: 'Projects',
  diagram: 'Diagrams'
} as const;

const USAGE_KIND_ICON = {
  entity: TbDatabase,
  relation: TbArrowsRightLeft,
  document: TbFileText,
  project: TbFolders,
  diagram: TbSitemap
} as const;

const GlossaryUsageLabelAdornment = ({ context }: EntityDrawerProviderLabelProps) => {
  const usage = useQuery(glossaryUsageQuery(context.workspaceId, context.entity._uid));
  const total = usage.data?.total ?? usage.data?.items.length ?? 0;

  return (
    <span className="dim" style={{ marginLeft: 8, fontWeight: 400 }}>
      {total} visible reference
      {total === 1 ? '' : 's'}
    </span>
  );
};

const GlossaryUsageProvider = ({ context }: EntityDrawerProviderProps) => {
  const usage = useQuery(glossaryUsageQuery(context.workspaceId, context.entity._uid));
  const usageItems = usage.data?.items ?? [];
  const usageGroups = (Object.keys(USAGE_KIND_LABEL) as Array<keyof typeof USAGE_KIND_LABEL>)
    .map(kind => ({ kind, items: usageItems.filter(item => item.kind === kind) }))
    .filter(group => group.items.length > 0);
  const state = usage.isLoading
    ? 'loading'
    : usage.isError
      ? 'unavailable'
      : usageGroups.length > 0
        ? 'ready'
        : 'empty';

  return (
    <EntityDrawerProviderStatus
      state={state}
      emptyMessage="No visible explicit usage found."
      unavailableMessage="Glossary usage is unavailable."
    >
      {usageGroups.map(group => {
        const KindIcon = USAGE_KIND_ICON[group.kind];
        return (
          <div key={group.kind} className={styles.usageGroup}>
            <div className={styles.usageGroupLabel}>{USAGE_KIND_LABEL[group.kind]}</div>
            {group.items.map((item, index) => (
              <div key={`${item.kind}:${item.id}:${index}`} className={styles.usageRow}>
                <KindIcon size={13} />
                <span>{item.label}</span>
                {item.context && <span className={styles.usageContext}>{item.context}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </EntityDrawerProviderStatus>
  );
};

export const businessGlossaryEntityDrawerProviderDefinitions = [
  {
    slotId: 'business-glossary.usage',
    supports: (_context: EntityDrawerProviderContext) => true,
    Component: GlossaryUsageProvider,
    LabelAdornment: GlossaryUsageLabelAdornment
  }
] satisfies readonly EntityDrawerProviderDefinition[];
