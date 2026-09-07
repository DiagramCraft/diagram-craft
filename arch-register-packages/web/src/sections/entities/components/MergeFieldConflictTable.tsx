import { TbLock } from 'react-icons/tb';
import { Table } from '../../../components/table/Table';
import type { MergeFieldConflict } from '@arch-register/api-types/entityMergeContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { CoreFieldLookups, FieldResolution } from '../mergeReviewState';
import {
  formatMergeCoreFieldValue,
  formatMergeFieldValue,
  formatMergeReferenceValue,
  isLookupCoreFieldConflict,
  isReferenceFieldConflict
} from '../mergeReviewState';
import styles from './MergeWizardDialog.module.css';

type RefLookup = ReadonlyMap<string, { name: string }>;

type Props = {
  conflicts: MergeFieldConflict[];
  resolutions: Record<string, FieldResolution>;
  onChange: (fieldKey: string, value: FieldResolution) => void;
  schema: EntitySchema | null;
  refLookup: RefLookup;
  coreFieldLookups: CoreFieldLookups;
};

const ConflictRow = ({
  conflict,
  resolution,
  onChange,
  schema,
  refLookup,
  coreFieldLookups
}: {
  conflict: MergeFieldConflict;
  resolution: FieldResolution | undefined;
  onChange: (fieldKey: string, value: FieldResolution) => void;
  schema: EntitySchema | null;
  refLookup: RefLookup;
  coreFieldLookups: CoreFieldLookups;
}) => {
  const isReference = isReferenceFieldConflict(conflict, schema);
  const isCoreLookup = isLookupCoreFieldConflict(conflict);
  const formatValue = (value: unknown) =>
    isReference
      ? formatMergeReferenceValue(value, refLookup)
      : isCoreLookup
        ? formatMergeCoreFieldValue(conflict, value, coreFieldLookups)
        : formatMergeFieldValue(value);

  return (
    <Table.Row>
      <Table.Cell>{conflict.fieldName}</Table.Cell>
      {conflict.restricted ? (
        <Table.Cell colSpan={3}>
          <span className={styles.restricted}>
            <TbLock size={11} /> Restricted — you don't have edit access to this field's group
          </span>
        </Table.Cell>
      ) : (
        <>
          <Table.Cell>{formatValue(conflict.source)}</Table.Cell>
          <Table.Cell>{formatValue(conflict.target)}</Table.Cell>
          <Table.Cell>
            <div className={styles.radioRow}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name={`merge-field-${conflict.fieldKey}`}
                  checked={resolution === 'source'}
                  onChange={() => onChange(conflict.fieldKey, 'source')}
                />
                Keep source
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name={`merge-field-${conflict.fieldKey}`}
                  checked={resolution !== 'source'}
                  onChange={() => onChange(conflict.fieldKey, 'target')}
                />
                Keep target
              </label>
            </div>
          </Table.Cell>
        </>
      )}
    </Table.Row>
  );
};

const ConflictGroup = ({
  title,
  conflicts,
  resolutions,
  onChange,
  schema,
  refLookup,
  coreFieldLookups
}: Props & { title: string }) => {
  if (conflicts.length === 0) return null;
  return (
    <>
      <Table.GroupHeaderRow colSpan={4}>{title}</Table.GroupHeaderRow>
      {conflicts.map(conflict => (
        <ConflictRow
          key={conflict.fieldKey}
          conflict={conflict}
          resolution={resolutions[conflict.fieldKey]}
          onChange={onChange}
          schema={schema}
          refLookup={refLookup}
          coreFieldLookups={coreFieldLookups}
        />
      ))}
    </>
  );
};

export const MergeFieldConflictTable = ({
  conflicts,
  resolutions,
  onChange,
  schema,
  refLookup,
  coreFieldLookups
}: Props) => {
  if (conflicts.length === 0) {
    return <p className={styles.fixedNote}>No field values differ between source and target.</p>;
  }
  const coreConflicts = conflicts.filter(c => c.kind === 'core');
  const dataConflicts = conflicts.filter(c => c.kind === 'data');

  return (
    <Table.Root>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>Field</Table.HeaderCell>
          <Table.HeaderCell>Source value</Table.HeaderCell>
          <Table.HeaderCell>Target value</Table.HeaderCell>
          <Table.HeaderCell>Keep</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <ConflictGroup
          title="Core fields"
          conflicts={coreConflicts}
          resolutions={resolutions}
          onChange={onChange}
          schema={schema}
          refLookup={refLookup}
          coreFieldLookups={coreFieldLookups}
        />
        <ConflictGroup
          title="Data fields"
          conflicts={dataConflicts}
          resolutions={resolutions}
          onChange={onChange}
          schema={schema}
          refLookup={refLookup}
          coreFieldLookups={coreFieldLookups}
        />
      </Table.Body>
    </Table.Root>
  );
};
