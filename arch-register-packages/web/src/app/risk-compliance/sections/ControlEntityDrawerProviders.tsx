import { Chip } from '../../../components/Chip';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import styles from './ControlEntityDrawerProviders.module.css';

const typedRelationField = (context: EntityDrawerProviderContext, fieldId: string) => {
  const field = context.schema.fields.find(candidate => candidate.id === fieldId);
  return field?.type === 'typedRelation' ? field : undefined;
};

const relationState = (
  context: EntityDrawerProviderContext,
  matches: unknown[]
): 'loading' | 'ready' | 'empty' | 'unavailable' => {
  if (context.typedRelationsStatus.isLoading) return 'loading';
  if (context.typedRelationsStatus.isError) return 'unavailable';
  return matches.length > 0 ? 'ready' : 'empty';
};

const allTypedRelations = (context: EntityDrawerProviderContext) => [
  ...context.typedRelations.outgoing,
  ...context.typedRelations.incoming
];

const MitigatedRisksProvider = ({ context, label }: EntityDrawerProviderProps) => {
  const field = typedRelationField(context, 'mitigated_risks');
  const matches = field
    ? allTypedRelations(context).filter(
        relation =>
          relation._schema.id === field.relationSchemaId && relation._out.id === context.entity._uid
      )
    : [];
  const state = field ? relationState(context, matches) : 'unavailable';

  return (
    <div className={styles.provider}>
      <div className={styles.sectionLabel}>{label}</div>
      <EntityDrawerProviderStatus state={state} emptyMessage="No risks mitigated.">
        {matches.map(relation => (
          <div className={styles.attributeRow} key={relation._uid}>
            <span className={styles.attributeLabel}>{relation._in.name}</span>
            <span className={styles.attributeValue}>
              {typeof relation.coverage === 'number' ? `${relation.coverage}%` : '—'} ·{' '}
              {typeof relation.effectiveness === 'string' ? relation.effectiveness : '—'}
            </span>
          </div>
        ))}
      </EntityDrawerProviderStatus>
    </div>
  );
};

const ProtectedEntitiesProvider = ({ context, label }: EntityDrawerProviderProps) => {
  const field = typedRelationField(context, 'protected_entities');
  const matches = field
    ? allTypedRelations(context).filter(
        relation =>
          relation._schema.id === field.relationSchemaId && relation._in.id === context.entity._uid
      )
    : [];
  const state = field ? relationState(context, matches) : 'unavailable';

  return (
    <div className={styles.provider}>
      <div className={styles.sectionLabel}>{label}</div>
      <EntityDrawerProviderStatus state={state} emptyMessage="No protected entities linked.">
        <div className={styles.tags}>
          {matches.map(relation => (
            <Chip key={relation._uid} tone="ghost">
              {relation._out.name}
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </div>
  );
};

const supportsTypedRelationField = (fieldId: string) => (context: EntityDrawerProviderContext) =>
  typedRelationField(context, fieldId) !== undefined;

export const riskComplianceEntityDrawerProviderDefinitions = [
  {
    slotId: 'risk.mitigated-risks',
    supports: supportsTypedRelationField('mitigated_risks'),
    Component: MitigatedRisksProvider
  },
  {
    slotId: 'risk.protected-entities',
    supports: supportsTypedRelationField('protected_entities'),
    Component: ProtectedEntitiesProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
