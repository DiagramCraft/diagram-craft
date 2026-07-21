import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import type { TechnologyEolMapping } from '@arch-register/api-types/jobsContract';
import { useSchemas } from '../../hooks/useSchemas';
import { useCreateJob } from '../../hooks/useJobs';
import { SchemaPickerStep } from './SchemaPickerStep';
import {
  SchemaFieldMappingStep,
  type SchemaFieldMappingDefinition
} from './SchemaFieldMappingStep';
import styles from './JobWizard.module.css';

type JobStep = 1 | 2 | 3 | 4;
type FrequencyUnit = 'minutes' | 'hours';
type MappingForm = Omit<TechnologyEolMapping, 'productFieldId' | 'cycleFieldId'> & {
  productFieldId: string | null;
  cycleFieldId: string | null;
};

const initialMapping: MappingForm = {
  productFieldId: null,
  cycleFieldId: null,
  latestVersionFieldId: null,
  releaseDateFieldId: null,
  supportUntilFieldId: null,
  securityUntilFieldId: null,
  eolDateFieldId: null,
  sourceUrlFieldId: null,
  synchronizedAtFieldId: null
};

const mappingDefinitions = (mapping: MappingForm): SchemaFieldMappingDefinition[] => [
  {
    id: 'productFieldId',
    label: 'Product key',
    description: 'The endoflife.date product identifier, for example nodejs or nginx.',
    direction: 'input',
    required: true,
    allowedTypes: ['text', 'longtext'],
    value: mapping.productFieldId
  },
  {
    id: 'cycleFieldId',
    label: 'Release cycle',
    description: 'The stable release cycle identifier, for example 22 or 1.25.',
    direction: 'input',
    required: true,
    allowedTypes: ['text', 'longtext'],
    value: mapping.cycleFieldId
  },
  ...(
    [
      ['latestVersionFieldId', 'Latest version', 'text'],
      ['releaseDateFieldId', 'Release date', 'date'],
      ['supportUntilFieldId', 'Active support until', 'date'],
      ['securityUntilFieldId', 'Security support until', 'date'],
      ['eolDateFieldId', 'End of life', 'date'],
      ['sourceUrlFieldId', 'Source URL', 'text'],
      ['synchronizedAtFieldId', 'Last synchronized at', 'date']
    ] as const
  ).map(([id, label, kind]) => ({
    id,
    label,
    description: 'Optional destination maintained by this job.',
    direction: 'output' as const,
    allowedTypes:
      kind === 'text'
        ? (['text', 'longtext'] as SchemaField['type'][])
        : (['date', 'text', 'longtext'] as SchemaField['type'][]),
    value: mapping[id as keyof MappingForm]
  }))
];

const isCompleteMapping = (mapping: MappingForm): mapping is TechnologyEolMapping =>
  typeof mapping.productFieldId === 'string' &&
  typeof mapping.cycleFieldId === 'string' &&
  (() => {
    const destinations = [
      mapping.latestVersionFieldId,
      mapping.releaseDateFieldId,
      mapping.supportUntilFieldId,
      mapping.securityUntilFieldId,
      mapping.eolDateFieldId,
      mapping.sourceUrlFieldId,
      mapping.synchronizedAtFieldId
    ].filter((value): value is string => value != null);
    return (
      destinations.length > 0 &&
      new Set(destinations).size === destinations.length &&
      !destinations.includes(mapping.productFieldId) &&
      !destinations.includes(mapping.cycleFieldId)
    );
  })();

export type CreateJobDialogProps = {
  open: boolean;
  workspaceSlug: string;
  onClose: () => void;
};

export const CreateJobDialog = ({ open, workspaceSlug, onClose }: CreateJobDialogProps) => {
  const [step, setStep] = useState<JobStep>(1);
  const [schemaId, setSchemaId] = useState('');
  const [mapping, setMapping] = useState<MappingForm>(initialMapping);
  const [frequencyValue, setFrequencyValue] = useState('24');
  const [frequencyUnit, setFrequencyUnit] = useState<FrequencyUnit>('hours');
  const {
    data: schemas = [],
    isLoading: schemasLoading,
    isError: schemasError
  } = useSchemas(workspaceSlug, open);
  const createJob = useCreateJob(workspaceSlug);
  const schema = useMemo(
    () => schemas.find(item => item.id === schemaId) ?? null,
    [schemaId, schemas]
  );
  const definitions = useMemo(() => mappingDefinitions(mapping), [mapping]);
  const numericFrequency = Number(frequencyValue);
  const canAdvance =
    step === 1
      ? true
      : step === 2
        ? schemaId !== ''
        : step === 3
          ? isCompleteMapping(mapping)
          : Number.isInteger(numericFrequency) && numericFrequency > 0;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSchemaId('');
    setMapping(initialMapping);
    setFrequencyValue('24');
    setFrequencyUnit('hours');
  }, [open]);

  const updateMapping = (id: string, fieldId: string | null) => {
    setMapping(current => ({ ...current, [id]: fieldId }));
  };

  const submit = async () => {
    if (!schemaId || !isCompleteMapping(mapping) || !Number.isInteger(numericFrequency)) return;
    try {
      await createJob.mutateAsync({
        jobType: 'technology-eol',
        schemaId,
        mapping,
        frequency: { unit: frequencyUnit, value: numericFrequency }
      });
      onClose();
    } catch {
      // The mutation error is displayed in the dialog.
    }
  };

  const stepContent =
    step === 1 ? (
      <div className={styles.stepStack}>
        <div>
          <div className={styles.stepTitle}>Choose a job type</div>
          <div className={styles.stepDescription}>
            Standard jobs update workspace data on a recurring schedule.
          </div>
        </div>
        <div className={styles.typeCard}>
          <div className={styles.typeCardTitle}>Technology End of Life</div>
          <div className={styles.typeCardDescription}>
            Hydrate release and support lifecycle fields from endoflife.date.
          </div>
        </div>
      </div>
    ) : step === 2 ? (
      <SchemaPickerStep
        schemas={schemas}
        value={schemaId}
        onChange={nextSchemaId => {
          setSchemaId(nextSchemaId);
          setMapping(initialMapping);
        }}
        isLoading={schemasLoading}
        isError={schemasError}
      />
    ) : step === 3 ? (
      <SchemaFieldMappingStep schema={schema} definitions={definitions} onChange={updateMapping} />
    ) : (
      <div className={styles.stepStack}>
        <div>
          <div className={styles.stepTitle}>Set the frequency</div>
          <div className={styles.stepDescription}>
            The job is enabled immediately. Its first run will start after this interval.
          </div>
        </div>
        <FormElement label="Run every" hint="Use a longer interval for large schemas.">
          <div className={styles.frequencyRow}>
            <TextInput
              value={frequencyValue}
              type="number"
              min={1}
              onChange={value => setFrequencyValue(value ?? '')}
            />
            <Select.Root
              value={frequencyUnit}
              onChange={value => setFrequencyUnit((value ?? 'hours') as FrequencyUnit)}
            >
              <Select.Item value="minutes">Minutes</Select.Item>
              <Select.Item value="hours">Hours</Select.Item>
            </Select.Root>
          </div>
        </FormElement>
        {createJob.error && (
          <div className={styles.notice} role="alert">
            {createJob.error instanceof Error
              ? createJob.error.message
              : 'The job could not be created.'}
          </div>
        )}
      </div>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add job"
      sub="Configure a recurring workspace job."
      width={720}
      footerLeft={
        <fieldset className={styles.progress} aria-label={`Step ${step} of 4`}>
          {['Job type', 'Target schema', 'Field mapping', 'Frequency'].map((label, index) => (
            <div
              key={label}
              className={styles.progressItem}
              data-active={index + 1 === step || index + 1 < step}
            >
              {index + 1}. {label}
            </div>
          ))}
        </fieldset>
      }
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose, disabled: createJob.isPending },
        ...(step > 1
          ? [
              {
                label: 'Back',
                type: 'secondary' as const,
                onClick: () => setStep((step - 1) as JobStep)
              }
            ]
          : []),
        step < 4
          ? {
              label: 'Next',
              type: 'default' as const,
              disabled: !canAdvance,
              onClick: () => setStep((step + 1) as JobStep)
            }
          : {
              label: createJob.isPending ? 'Creating…' : 'Create job',
              type: 'default' as const,
              disabled: !canAdvance || createJob.isPending,
              onClick: () => void submit()
            }
      ]}
    >
      {stepContent}
    </Dialog>
  );
};
