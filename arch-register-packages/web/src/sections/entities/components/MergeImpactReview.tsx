import { Banner } from '../../../components/Banner';
import { Table } from '../../../components/table/Table';
import type {
  MergeBlocker,
  MergeDependentImpact,
  MergePreview,
  MergeRelationConflict,
  MergeSideTableConflict
} from '@arch-register/api-types/entityMergeContract';
import type { ConflictResolution } from '../mergeReviewState';
import { formatSideTableLabel } from '../mergeReviewState';
import styles from './MergeWizardDialog.module.css';

const BlockerBanners = ({
  blockers,
  acknowledged,
  onToggleAck
}: {
  blockers: MergeBlocker[];
  acknowledged: ReadonlySet<string>;
  onToggleAck: (code: string) => void;
}) => {
  if (blockers.length === 0) return null;
  return (
    <div className={styles.section}>
      {blockers.map(blocker =>
        blocker.acknowledgeable ? (
          <Banner
            key={blocker.code}
            variant="warning"
            action={
              <label className={styles.radioOption}>
                <input
                  type="checkbox"
                  checked={acknowledged.has(blocker.code)}
                  onChange={() => onToggleAck(blocker.code)}
                />
                I understand and want to proceed
              </label>
            }
          >
            {blocker.message}
          </Banner>
        ) : (
          <Banner key={blocker.code} variant="error">
            {blocker.message}
          </Banner>
        )
      )}
    </div>
  );
};

const DependentImpactList = ({ dependents }: { dependents: MergeDependentImpact[] }) => {
  if (dependents.length === 0) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Dependent entities (will be repointed)</div>
      <div className={styles.impactList}>
        {dependents.map(dep => (
          <div key={`${dep.entityId}-${dep.fieldName}`} className={styles.impactRow}>
            <span>{dep.entityName}</span>
            <span className={styles.fixedNote}>
              {dep.schemaName} · {dep.fieldName} ({dep.kind})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RelationConflictTable = ({
  conflicts,
  resolutions,
  onChange
}: {
  conflicts: MergeRelationConflict[];
  resolutions: Record<string, ConflictResolution>;
  onChange: (relationId: string, value: ConflictResolution) => void;
}) => {
  if (conflicts.length === 0) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Relation conflicts</div>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Relation</Table.HeaderCell>
            <Table.HeaderCell>Other entity</Table.HeaderCell>
            <Table.HeaderCell>Note</Table.HeaderCell>
            <Table.HeaderCell>Resolution</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {conflicts.map(conflict => (
            <Table.Row key={conflict.relationId}>
              <Table.Cell>
                {conflict.relationSchemaName} ({conflict.direction})
              </Table.Cell>
              <Table.Cell>{conflict.otherRecordName}</Table.Cell>
              <Table.Cell>
                {conflict.note === 'duplicate'
                  ? 'Duplicate of an existing target relation'
                  : 'Would become a self-relation'}
              </Table.Cell>
              <Table.Cell>
                {conflict.note === 'self' ? (
                  <span className={styles.fixedNote}>Will be dropped</span>
                ) : (
                  <div className={styles.radioRow}>
                    {(['keep_source', 'keep_target', 'drop_source'] as const).map(option => (
                      <label key={option} className={styles.radioOption}>
                        <input
                          type="radio"
                          name={`merge-relation-${conflict.relationId}`}
                          checked={resolutions[conflict.relationId] === option}
                          onChange={() => onChange(conflict.relationId, option)}
                        />
                        {option === 'keep_source'
                          ? 'Keep source'
                          : option === 'keep_target'
                            ? 'Keep target'
                            : 'Drop'}
                      </label>
                    ))}
                  </div>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
};

const SideTableConflictTable = ({
  conflicts,
  resolutions,
  onChange
}: {
  conflicts: MergeSideTableConflict[];
  resolutions: Record<string, ConflictResolution>;
  onChange: (conflictId: string, value: ConflictResolution) => void;
}) => {
  if (conflicts.length === 0) return null;
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Other conflicts</div>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Area</Table.HeaderCell>
            <Table.HeaderCell>Resolution</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {conflicts.map(conflict => (
            <Table.Row key={conflict.conflictId}>
              <Table.Cell>{formatSideTableLabel(conflict.table)}</Table.Cell>
              <Table.Cell>
                <div className={styles.radioRow}>
                  {(['keep_source', 'keep_target', 'drop_source'] as const).map(option => (
                    <label key={option} className={styles.radioOption}>
                      <input
                        type="radio"
                        name={`merge-sidetable-${conflict.conflictId}`}
                        checked={resolutions[conflict.conflictId] === option}
                        onChange={() => onChange(conflict.conflictId, option)}
                      />
                      {option === 'keep_source'
                        ? 'Keep source'
                        : option === 'keep_target'
                          ? 'Keep target'
                          : 'Drop'}
                    </label>
                  ))}
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </div>
  );
};

const CountsStrip = ({ counts }: { counts: MergePreview['sideTableCounts'] }) => (
  <div className={styles.countsStrip}>
    <span>{counts.entityVersions} entity versions transferring</span>
    <span>{counts.openChangeApprovals} open change approvals</span>
    <span>{counts.openGovernanceCases} open governance cases</span>
    <span>{counts.incomingRelations} incoming relations</span>
    <span>{counts.outgoingRelations} outgoing relations</span>
    <span>{counts.externalIdentitiesTransferring} external identities transferring</span>
    {counts.externalIdentitiesColliding > 0 && (
      <span>{counts.externalIdentitiesColliding} external identities dropped (already on target)</span>
    )}
  </div>
);

type Props = {
  preview: MergePreview;
  relationResolutions: Record<string, ConflictResolution>;
  sideTableResolutions: Record<string, ConflictResolution>;
  acknowledgedBlockers: ReadonlySet<string>;
  onRelationChange: (relationId: string, value: ConflictResolution) => void;
  onSideTableChange: (conflictId: string, value: ConflictResolution) => void;
  onToggleBlockerAck: (code: string) => void;
};

export const MergeImpactReview = ({
  preview,
  relationResolutions,
  sideTableResolutions,
  acknowledgedBlockers,
  onRelationChange,
  onSideTableChange,
  onToggleBlockerAck
}: Props) => (
  <>
    <BlockerBanners
      blockers={preview.blockers}
      acknowledged={acknowledgedBlockers}
      onToggleAck={onToggleBlockerAck}
    />
    <DependentImpactList dependents={preview.dependentImpact} />
    <RelationConflictTable
      conflicts={preview.relationConflicts}
      resolutions={relationResolutions}
      onChange={onRelationChange}
    />
    <SideTableConflictTable
      conflicts={preview.sideTableConflicts}
      resolutions={sideTableResolutions}
      onChange={onSideTableChange}
    />
    <CountsStrip counts={preview.sideTableCounts} />
    {preview.truncated && (
      <Banner variant="info">
        The dependent-impact list is very large and was truncated in this preview.
      </Banner>
    )}
  </>
);
